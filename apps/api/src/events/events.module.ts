import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventService } from './domain-event.service';
import { DomainEventListener } from './domain-event.listener';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [DomainEventService, DomainEventListener],
  exports: [DomainEventService],
})
export class EventsModule {}
