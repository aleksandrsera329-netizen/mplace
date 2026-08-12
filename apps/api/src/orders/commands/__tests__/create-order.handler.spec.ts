import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../../auth/jwt-payload.interface';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { OrdersService } from '../../orders.service';
import { CreateOrderCommand } from '../create-order.command';
import { CreateOrderHandler } from '../create-order.handler';

describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let orders: { checkout: jest.Mock };
  let outbox: { enqueue: jest.Mock };

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'buyer@test.com',
    role: UserRole.CUSTOMER,
    shopId: null,
  };

  beforeEach(async () => {
    orders = { checkout: jest.fn() };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOrderHandler,
        { provide: OrdersService, useValue: orders },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(CreateOrderHandler);
  });

  it('should checkout and enqueue OrderCreatedEvent for each order', async () => {
    const mockResult = {
      orders: [
        {
          id: 'order-1',
          orderNumber: 'ORD-1',
          totalCents: 10000,
          shop: { id: 'shop-1' },
        },
        {
          id: 'order-2',
          orderNumber: 'ORD-2',
          totalCents: 5000,
          shop: { id: 'shop-2' },
        },
      ],
    };
    orders.checkout.mockResolvedValue(mockResult);

    const command = new CreateOrderCommand(user, 'session-abc', {
      customerName: 'Buyer',
      customerEmail: 'buyer@test.com',
    });

    const result = await handler.execute(command);

    expect(result).toBe(mockResult);
    expect(orders.checkout).toHaveBeenCalledWith(
      user,
      'session-abc',
      command.dto,
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'OrderCreatedEvent',
      expect.objectContaining({
        orderId: 'order-1',
        customerId: 'user-1',
        totalCents: 10000,
        shopIds: ['shop-1'],
        orderNumber: 'ORD-1',
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'OrderCreatedEvent',
      expect.objectContaining({
        orderId: 'order-2',
        shopIds: ['shop-2'],
      }),
    );
  });

  it('should not enqueue when checkout returns no orders', async () => {
    orders.checkout.mockResolvedValue({ orders: [] });

    await handler.execute(new CreateOrderCommand(user, undefined, {}));

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('should pass null customerId when guest checkout', async () => {
    orders.checkout.mockResolvedValue({
      orders: [
        {
          id: 'order-g',
          orderNumber: 'ORD-G',
          totalCents: 100,
          shop: { id: 'shop-1' },
        },
      ],
    });

    await handler.execute(
      new CreateOrderCommand(null, 'guest-session', {
        customerEmail: 'guest@test.com',
      }),
    );

    expect(outbox.enqueue).toHaveBeenCalledWith(
      'OrderCreatedEvent',
      expect.objectContaining({
        customerId: null,
        orderId: 'order-g',
      }),
    );
  });
});
