import { Controller, Get, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }

  /**
   * Terminus health: database + optional Redis.
   * GET /api/health
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check (database + Redis if configured)' })
  check() {
    const checks = [
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ];

    if (this.redis) {
      checks.push(() => this.checkRedis());
    }

    return this.health.check(checks);
  }

  /**
   * Lightweight status for storefront badge.
   * GET /api/health/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Simple status JSON for UI badge' })
  async status() {
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' | 'skipped' = 'skipped';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    if (this.redis) {
      try {
        if (this.redis.status !== 'ready') {
          await this.redis.connect();
        }
        const pong = await this.redis.ping();
        redis = pong === 'PONG' ? 'up' : 'down';
      } catch {
        redis = 'down';
      }
    }

    const ok = database === 'up' && redis !== 'down';
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'mplace-api',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const key = 'redis';
    try {
      if (!this.redis) {
        return { [key]: { status: 'up', message: 'not configured' } };
      }
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected PING reply: ${pong}`);
      }
      return { [key]: { status: 'up' } };
    } catch (e) {
      const result: HealthIndicatorResult = {
        [key]: { status: 'down', message: (e as Error).message },
      };
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
