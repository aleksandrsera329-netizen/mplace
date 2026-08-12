import { DomainEvent } from './domain-event';

export class RfqClosedEvent extends DomainEvent {
  constructor(
    public readonly rfqId: string,
    public readonly buyerId: string,
    public readonly reason?: string,
  ) {
    super();
  }
}
