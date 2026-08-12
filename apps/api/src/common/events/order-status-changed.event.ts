import { DomainEvent } from './domain-event';

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly changedBy: string | null,
  ) {
    super();
  }
}
