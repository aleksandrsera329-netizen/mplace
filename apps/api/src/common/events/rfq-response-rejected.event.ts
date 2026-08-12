import { DomainEvent } from './domain-event';

export class RfqResponseRejectedEvent extends DomainEvent {
  constructor(
    public readonly responseId: string,
    public readonly rfqId: string,
    public readonly shopId: string,
    public readonly buyerId: string,
    public readonly reason?: string,
  ) {
    super();
  }
}
