import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isRunning = false;
  private timer: ReturnType<typeof setInterval> | null = null;

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
    this.isRunning = true;
    try {
      const processed = await this.outboxService.processPending(30);
      if (processed > 0) {
        this.logger.debug(`Outbox processed ${processed} events`);
      }
    } catch (e) {
      this.logger.error(
        `Outbox tick error: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
