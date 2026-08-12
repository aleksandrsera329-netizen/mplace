import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

describe('MetricsService (Stage 27)', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService({
      get: jest.fn((k: string) =>
        k === 'NODE_ENV' ? 'test' : undefined,
      ),
    } as unknown as ConfigService);
  });

  afterEach(() => {
    metrics.onModuleDestroy();
  });

  it('exposes Prometheus text with http counters', async () => {
    metrics.observeHttp('GET', '/api/health', 200, 0.012);
    metrics.incPaymentSucceeded();
    metrics.incPaymentFailed('test');
    metrics.incWebhookProcessed('processed');
    metrics.incWebhookFailed('signature');
    metrics.setDependency('postgres', true);

    const text = await metrics.metricsText();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('payments_failed_total');
    expect(text).toContain('payments_succeeded_total');
    expect(text).toContain('webhooks_failed_total');
    expect(text).toContain('bullmq_queue_waiting');
    expect(text).toContain('mplace_dependency_up');
  });

  it('contentType is Prometheus format', () => {
    expect(metrics.contentType()).toMatch(/text\/plain/);
  });
});
