import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isRunning = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextAt = 0;
  private failStreak = 0;

  constructor(private readonly outboxService: OutboxService) {}

  onModuleInit() {
    // Skip tight polling in tests
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), 3000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.isRunning) return;
    if (Date.now() < this.nextAt) return;
    this.isRunning = true;
    try {
      const processed = await this.outboxService.processPending(30);
      this.failStreak = 0;
      if (processed > 0) {
        this.logger.debug(`Outbox processed ${processed} events`);
      }
    } catch (e) {
      this.failStreak += 1;
      const delay = Math.min(60_000, 3000 * 2 ** Math.min(this.failStreak, 5));
      this.nextAt = Date.now() + delay;
      if (this.failStreak <= 2 || this.failStreak % 8 === 0) {
        this.logger.error(
          `Outbox tick error (backoff ${delay}ms): ${e instanceof Error ? e.message : e}`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }
}
