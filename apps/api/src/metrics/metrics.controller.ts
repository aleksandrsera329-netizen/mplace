import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * Prometheus scrape endpoint.
   * GET /api/metrics
   */
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics (text exposition format)' })
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response) {
    const body = await this.metrics.metricsText();
    res.setHeader('Content-Type', this.metrics.contentType());
    res.status(200).send(body);
  }
}
