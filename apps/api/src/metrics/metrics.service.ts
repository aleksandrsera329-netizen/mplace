import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import {
  QUEUE_EMAIL,
  QUEUE_IMPORTS,
  QUEUE_INVENTORY,
  QUEUE_NOTIFICATIONS,
  QUEUE_PAYOUTS,
  QUEUE_SEARCH,
  QUEUE_WEBHOOKS,
} from '../queue/queue.constants';

/**
 * Stage 27 — Prometheus metrics (prom-client).
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly paymentsFailedTotal: Counter<string>;
  readonly paymentsSucceededTotal: Counter<string>;
  readonly webhooksFailedTotal: Counter<string>;
  readonly webhooksProcessedTotal: Counter<string>;
  readonly payoutsFailedTotal: Counter<string>;
  readonly bullmqQueueWaiting: Gauge<string>;
  readonly bullmqQueueActive: Gauge<string>;
  readonly bullmqJobsFailed: Gauge<string>;
  readonly bullmqJobsCompleted: Gauge<string>;
  readonly dependencyUp: Gauge<string>;

  private readonly queueMap = new Map<string, Queue | undefined>();

  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectQueue(QUEUE_EMAIL) emailQ?: Queue,
    @Optional() @InjectQueue(QUEUE_NOTIFICATIONS) notifyQ?: Queue,
    @Optional() @InjectQueue(QUEUE_SEARCH) searchQ?: Queue,
    @Optional() @InjectQueue(QUEUE_IMPORTS) importQ?: Queue,
    @Optional() @InjectQueue(QUEUE_INVENTORY) inventoryQ?: Queue,
    @Optional() @InjectQueue(QUEUE_PAYOUTS) payoutsQ?: Queue,
    @Optional() @InjectQueue(QUEUE_WEBHOOKS) webhooksQ?: Queue,
  ) {
    this.registry.setDefaultLabels({
      service: 'mplace-api',
      env: this.config.get<string>('NODE_ENV') || 'development',
    });

    collectDefaultMetrics({ register: this.registry, prefix: 'mplace_' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.paymentsFailedTotal = new Counter({
      name: 'payments_failed_total',
      help: 'Failed payment operations',
      labelNames: ['reason'] as const,
      registers: [this.registry],
    });

    this.paymentsSucceededTotal = new Counter({
      name: 'payments_succeeded_total',
      help: 'Successful payments',
      registers: [this.registry],
    });

    this.webhooksFailedTotal = new Counter({
      name: 'webhooks_failed_total',
      help: 'Failed Stripe webhooks',
      labelNames: ['reason'] as const,
      registers: [this.registry],
    });

    this.webhooksProcessedTotal = new Counter({
      name: 'webhooks_processed_total',
      help: 'Processed Stripe webhooks',
      labelNames: ['status'] as const,
      registers: [this.registry],
    });

    this.payoutsFailedTotal = new Counter({
      name: 'payouts_failed_total',
      help: 'Failed payout operations',
      labelNames: ['reason'] as const,
      registers: [this.registry],
    });

    this.bullmqQueueWaiting = new Gauge({
      name: 'bullmq_queue_waiting',
      help: 'BullMQ jobs waiting',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.bullmqQueueActive = new Gauge({
      name: 'bullmq_queue_active',
      help: 'BullMQ jobs active',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.bullmqJobsFailed = new Gauge({
      name: 'bullmq_jobs_failed',
      help: 'BullMQ failed job count (approx from queue)',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.bullmqJobsCompleted = new Gauge({
      name: 'bullmq_jobs_completed',
      help: 'BullMQ completed job count (approx)',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.dependencyUp = new Gauge({
      name: 'mplace_dependency_up',
      help: 'Dependency availability (1=up, 0=down)',
      labelNames: ['name'] as const,
      registers: [this.registry],
    });

    this.queueMap.set(QUEUE_EMAIL, emailQ);
    this.queueMap.set(QUEUE_NOTIFICATIONS, notifyQ);
    this.queueMap.set(QUEUE_SEARCH, searchQ);
    this.queueMap.set(QUEUE_IMPORTS, importQ);
    this.queueMap.set(QUEUE_INVENTORY, inventoryQ);
    this.queueMap.set(QUEUE_PAYOUTS, payoutsQ);
    this.queueMap.set(QUEUE_WEBHOOKS, webhooksQ);
  }

  onModuleDestroy() {
    this.registry.clear();
  }

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    durationSec: number,
  ) {
    const labels = {
      method: method.toUpperCase(),
      route: route || 'unknown',
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSec);
  }

  incPaymentFailed(reason: string) {
    this.paymentsFailedTotal.inc({ reason: reason.slice(0, 64) });
  }

  incPaymentSucceeded() {
    this.paymentsSucceededTotal.inc();
  }

  incWebhookFailed(reason: string) {
    this.webhooksFailedTotal.inc({ reason: reason.slice(0, 64) });
  }

  incWebhookProcessed(status: string) {
    this.webhooksProcessedTotal.inc({ status: status.slice(0, 32) });
  }

  incPayoutFailed(reason: string) {
    this.payoutsFailedTotal.inc({ reason: reason.slice(0, 64) });
  }

  setDependency(name: string, up: boolean) {
    this.dependencyUp.set({ name }, up ? 1 : 0);
  }

  /** Refresh BullMQ gauges before scrape */
  async refreshQueueMetrics() {
    for (const [name, q] of this.queueMap) {
      if (!q) {
        this.bullmqQueueWaiting.set({ queue: name }, 0);
        this.bullmqQueueActive.set({ queue: name }, 0);
        this.bullmqJobsFailed.set({ queue: name }, 0);
        this.bullmqJobsCompleted.set({ queue: name }, 0);
        continue;
      }
      try {
        const counts = await q.getJobCounts(
          'waiting',
          'active',
          'failed',
          'completed',
          'delayed',
        );
        this.bullmqQueueWaiting.set(
          { queue: name },
          (counts.waiting || 0) + (counts.delayed || 0),
        );
        this.bullmqQueueActive.set({ queue: name }, counts.active || 0);
        this.bullmqJobsFailed.set({ queue: name }, counts.failed || 0);
        this.bullmqJobsCompleted.set({ queue: name }, counts.completed || 0);
      } catch (e) {
        this.logger.debug(
          `queue metrics ${name}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  async metricsText(): Promise<string> {
    await this.refreshQueueMetrics();
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
