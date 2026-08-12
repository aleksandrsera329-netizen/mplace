import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../../../auth/jwt-payload.interface';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrdersService } from '../../orders.service';
import { ChangeOrderStatusCommand } from '../change-order-status.command';
import { ChangeOrderStatusHandler } from '../change-order-status.handler';

describe('ChangeOrderStatusHandler', () => {
  let handler: ChangeOrderStatusHandler;
  let orders: { updateStatus: jest.Mock };
  let prisma: { order: { findUnique: jest.Mock } };
  let outbox: { enqueue: jest.Mock };

  const user: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    shopId: null,
  };

  beforeEach(async () => {
    orders = { updateStatus: jest.fn() };
    prisma = { order: { findUnique: jest.fn() } };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeOrderStatusHandler,
        { provide: OrdersService, useValue: orders },
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(ChangeOrderStatusHandler);
  });

  it('should update status and write OrderStatusChangedEvent to outbox', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PENDING_PAYMENT,
    });
    const updated = {
      id: 'ord-1',
      status: OrderStatus.PAID,
    };
    orders.updateStatus.mockResolvedValue(updated);

    const result = await handler.execute(
      new ChangeOrderStatusCommand(
        'ord-1',
        OrderStatus.PAID,
        user,
        'payment confirmed',
      ),
    );

    expect(result).toBe(updated);
    expect(orders.updateStatus).toHaveBeenCalledWith(
      user,
      'ord-1',
      OrderStatus.PAID,
      'payment confirmed',
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'OrderStatusChangedEvent',
      expect.objectContaining({
        orderId: 'ord-1',
        oldStatus: OrderStatus.PENDING_PAYMENT,
        newStatus: OrderStatus.PAID,
        changedBy: 'admin-1',
      }),
    );
  });

  it('should use UNKNOWN as oldStatus when order row missing before update', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    orders.updateStatus.mockResolvedValue({
      id: 'ord-2',
      status: OrderStatus.CANCELLED,
    });

    await handler.execute(
      new ChangeOrderStatusCommand('ord-2', OrderStatus.CANCELLED, user),
    );

    expect(outbox.enqueue).toHaveBeenCalledWith(
      'OrderStatusChangedEvent',
      expect.objectContaining({
        oldStatus: 'UNKNOWN',
        newStatus: OrderStatus.CANCELLED,
      }),
    );
  });

  it('should not enqueue if updateStatus throws', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.COMPLETED,
    });
    orders.updateStatus.mockRejectedValue(new Error('invalid transition'));

    await expect(
      handler.execute(
        new ChangeOrderStatusCommand('ord-1', OrderStatus.PAID, user),
      ),
    ).rejects.toThrow('invalid transition');

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
