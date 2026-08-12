import { DomainEvent } from './domain-event';

/** Merchant submitted an offer (RfqOffer) */
export class RfqResponseCreatedEvent extends DomainEvent {
  constructor(
    public readonly responseId: string,
    public readonly rfqId: string,
    public readonly shopId: string,
    public readonly merchantId: string,
    public readonly totalCents: number,
  ) {
    super();
  }
}
