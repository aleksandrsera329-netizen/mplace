import { DomainEvent } from './domain-event';

export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly totalCents: number,
    public readonly shopIds: string[],
    public readonly orderNumber?: string,
  ) {
    super();
  }
}
