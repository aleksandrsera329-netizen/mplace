import { DomainEvent } from './domain-event';

export class RfqCreatedEvent extends DomainEvent {
  constructor(
    public readonly rfqId: string,
    public readonly buyerId: string,
    public readonly title: string,
    public readonly categoryIds: string[] = [],
    public readonly shopIds: string[] = [],
    public readonly number?: string,
  ) {
    super();
  }
}
