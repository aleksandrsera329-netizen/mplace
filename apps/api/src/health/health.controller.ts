import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Terminus health (database ping). Used by Docker / k8s probes.
   * GET /api/health
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check (database)' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // later: Redis, Stripe
    ]);
  }

  /**
   * Lightweight status for storefront badge (stable shape).
   * GET /api/health/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Simple status JSON for UI badge' })
  async status() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'mplace-api',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
