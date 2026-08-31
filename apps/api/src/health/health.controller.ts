import {
  Controller,
  Get,
  HttpStatus,
  OnModuleDestroy,
  Res,
} from '@nestjs/common';
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
import type { Response } from 'express';
import Redis from 'ioredis';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

type DepStatus = 'up' | 'down' | 'skipped';

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
    private readonly metrics: MetricsService,
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
   * Liveness: process is up (k8s livenessProbe).
   * GET /api/health
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe (process up)' })
  live() {
    return this.livenessBody();
  }

  /** Alias: GET /api/health/live */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe alias' })
  liveAlias() {
    return this.livenessBody();
  }

  private livenessBody() {
    return {
      status: 'ok',
      probe: 'liveness',
      service: 'mplace-api',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: Postgres + Redis + Meilisearch (when configured).
   * GET /api/health/ready
   * Returns 503 if any required dependency is down.
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe (Postgres + Redis + Meilisearch)',
  })
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks = await this.probeDependencies(true);
    const ready = checks.ready;
    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: ready ? 'ok' : 'not_ready',
      probe: 'readiness',
      service: 'mplace-api',
      ...checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Full Terminus health (compat): DB hard-fail; Redis hard-fail if configured.
   * GET /api/health/full
   */
  @Get('full')
  @HealthCheck()
  @ApiOperation({
    summary: 'Full health check (Terminus: database + Redis + Meili)',
  })
  check() {
    const checks: Array<() => Promise<HealthIndicatorResult>> = [
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ];

    if (this.redis) {
      checks.push(() => this.checkRedis());
    } else {
      checks.push(async () => ({
        redis: { status: 'up', message: 'not configured' },
      }));
    }

    checks.push(() => this.checkMeilisearch(false));
    checks.push(async () => this.checkStripeConfig());

    return this.health.check(checks);
  }

  /**
   * Lightweight status for storefront badge.
   * GET /api/health/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Simple status JSON for UI badge' })
  async status() {
    const checks = await this.probeDependencies(false);
    const ok = checks.database === 'up' && checks.redis !== 'down';
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'mplace-api',
      database: checks.database,
      redis: checks.redis,
      meilisearch: checks.meilisearch,
      stripe: checks.stripe,
      ready: checks.ready,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Probe deps and update Prometheus gauges.
   * @param strictMeili — if true and MEILISEARCH_URL set, down Meili fails readiness
   */
  private async probeDependencies(strictMeili: boolean) {
    let database: DepStatus = 'down';
    let redis: DepStatus = 'skipped';
    let meilisearch: DepStatus = 'skipped';
    let stripe: 'configured' | 'missing' = 'missing';

    try {
      let lastErr: unknown;
      for (let i = 1; i <= 3; i++) {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (i < 3) await new Promise((r) => setTimeout(r, 400 * i));
        }
      }
      database = lastErr ? 'down' : 'up';
    } catch {
      database = 'down';
    }
    this.metrics.setDependency('postgres', database === 'up');

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
    this.metrics.setDependency(
      'redis',
      redis === 'up' || redis === 'skipped',
    );

    const meiliUrl = this.config.get<string>('MEILISEARCH_URL');
    if (meiliUrl) {
      try {
        const res = await fetch(`${meiliUrl.replace(/\/$/, '')}/health`, {
          signal: AbortSignal.timeout(2500),
        });
        meilisearch = res.ok ? 'up' : 'down';
      } catch {
        meilisearch = 'down';
      }
    }
    this.metrics.setDependency(
      'meilisearch',
      meilisearch === 'up' || meilisearch === 'skipped',
    );

    if (this.config.get<string>('STRIPE_SECRET_KEY')) {
      stripe = 'configured';
    }

    const redisOk = redis !== 'down'; // skipped is OK
    const meiliOk =
      !strictMeili || meilisearch === 'skipped' || meilisearch === 'up';
    // If Meili configured and strict readiness — require up
    const ready =
      database === 'up' &&
      redisOk &&
      (strictMeili
        ? meilisearch === 'skipped' || meilisearch === 'up'
        : true);

    return {
      database,
      redis,
      meilisearch,
      stripe,
      ready: ready && meiliOk,
    };
  }

  private async checkMeilisearch(
    failHard: boolean,
  ): Promise<HealthIndicatorResult> {
    const key = 'meilisearch';
    const meiliUrl = this.config.get<string>('MEILISEARCH_URL');
    if (!meiliUrl) {
      return { [key]: { status: 'up', message: 'not configured' } };
    }
    try {
      const res = await fetch(`${meiliUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return { [key]: { status: 'up' } };
    } catch (e) {
      if (failHard) {
        const result: HealthIndicatorResult = {
          [key]: { status: 'down', message: (e as Error).message },
        };
        throw new HealthCheckError('Meilisearch check failed', result);
      }
      return {
        [key]: {
          status: 'up',
          message: `degraded: ${(e as Error).message}`,
        },
      };
    }
  }

  private checkStripeConfig(): HealthIndicatorResult {
    const key = 'stripe';
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      return {
        [key]: {
          status: 'up',
          message: 'STRIPE_SECRET_KEY not set (demo mode)',
        },
      };
    }
    return {
      [key]: {
        status: 'up',
        mode: secret.startsWith('sk_live') ? 'live' : 'test_or_other',
      },
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
