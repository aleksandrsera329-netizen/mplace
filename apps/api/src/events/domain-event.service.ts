import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventName } from './domain-events';

@Injectable()
export class DomainEventService {
  private readonly logger = new Logger(DomainEventService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: DomainEventName, payload: Record<string, unknown>) {
    this.logger.debug(`emit ${event}`);
    this.emitter.emit(event, {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  }
}
