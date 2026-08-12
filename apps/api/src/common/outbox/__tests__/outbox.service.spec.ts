import { EventBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxService } from '../outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;
  let prisma: {
    outbox: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    prisma = {
      outbox: {
        create: jest.fn().mockResolvedValue({ id: 'ob-1' }),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    eventBus = { publish: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(OutboxService);
  });

  it('should add event to outbox within transaction (addToOutbox)', async () => {
    const tx = {
      outbox: { create: jest.fn().mockResolvedValue({ id: 'tx-ob' }) },
    };

    await service.addToOutbox(tx as any, 'OrderCreatedEvent', {
      orderId: 'ord-1',
      totalCents: 1000,
    });

    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: 'OrderCreatedEvent',
        payload: { orderId: 'ord-1', totalCents: 1000 },
        status: 'PENDING',
      },
    });
  });

  it('should enqueue event outside transaction', async () => {
    await service.enqueue('OrderStatusChangedEvent', {
      orderId: 'ord-1',
      oldStatus: 'PENDING_PAYMENT',
      newStatus: 'PAID',
    });

    expect(prisma.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: 'OrderStatusChangedEvent',
        payload: {
          orderId: 'ord-1',
          oldStatus: 'PENDING_PAYMENT',
          newStatus: 'PAID',
        },
        status: 'PENDING',
      },
    });
  });

  it('should process pending events and publish domain events', async () => {
    prisma.outbox.findMany.mockResolvedValue([
      {
        id: 'ob-1',
        eventType: 'OrderCreatedEvent',
        payload: {
          orderId: 'ord-1',
          customerId: 'u-1',
          totalCents: 500,
          shopIds: ['s-1'],
          orderNumber: 'N1',
        },
        attempts: 0,
      },
    ]);

    const count = await service.processPending(10);

    expect(count).toBe(1);
    expect(eventBus.publish).toHaveBeenCalled();
    expect(prisma.outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ob-1' },
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );
  });
});
