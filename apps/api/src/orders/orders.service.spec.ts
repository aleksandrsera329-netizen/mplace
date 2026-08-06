import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockTx = {
    order: {
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
  };

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) =>
      cb(mockTx),
    ),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockAudit.log.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listOrders', () => {
    it('should return orders for customer', async () => {
      const mockOrders = [
        {
          id: 'o1',
          orderNumber: 'MP-001',
          status: OrderStatus.PAID,
          totalCents: 10000,
        },
        {
          id: 'o2',
          orderNumber: 'MP-002',
          status: OrderStatus.PENDING_PAYMENT,
          totalCents: 5000,
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const user: JwtPayload = {
        sub: 'user-1',
        email: 'c@demo.com',
        role: UserRole.CUSTOMER,
        shopId: null,
      };
      const result = await service.listOrders(user, { limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('hasMore');
      expect(result.hasMore).toBe(false);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'user-1' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const user: JwtPayload = {
        sub: 'user-1',
        email: 'c@demo.com',
        role: UserRole.CUSTOMER,
        shopId: null,
      };
      await service.listOrders(user, { status: 'PAID' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: OrderStatus.PAID }),
        }),
      );
    });

    it('should filter merchant by shopId', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      const user: JwtPayload = {
        sub: 'm1',
        email: 'm@demo.com',
        role: UserRole.MERCHANT,
        shopId: 'shop-1',
      };
      await service.listOrders(user, { limit: 10 });
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shopId: 'shop-1' }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update order status PAID → PROCESSING for merchant', async () => {
      const existing = {
        id: 'o1',
        status: OrderStatus.PAID,
        shopId: 'shop-1',
        customerId: 'c1',
      };

      mockPrisma.order.findUnique.mockResolvedValue(existing);
      mockTx.order.update.mockResolvedValue({
        ...existing,
        status: OrderStatus.PROCESSING,
        items: [],
        shop: { id: 'shop-1', name: 'Shop' },
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});

      const user: JwtPayload = {
        sub: 'merchant-1',
        email: 'm@demo.com',
        role: UserRole.MERCHANT,
        shopId: 'shop-1',
      };

      // Machine: MERCHANT PAID → PROCESSING (not SHIPPED)
      const result = await service.updateStatus(
        user,
        'o1',
        OrderStatus.PROCESSING,
      );

      expect(result.status).toBe(OrderStatus.PROCESSING);
      expect(mockTx.orderStatusHistory.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STATUS_CHANGE' }),
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          {
            sub: 'u1',
            email: 'a@a.com',
            role: UserRole.ADMIN,
            shopId: null,
          },
          'missing',
          OrderStatus.SHIPPED,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if merchant tries to update foreign order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PAID,
        shopId: 'other-shop',
        customerId: 'c1',
      });

      const user: JwtPayload = {
        sub: 'merchant-1',
        email: 'm@demo.com',
        role: UserRole.MERCHANT,
        shopId: 'shop-1',
      };

      await expect(
        service.updateStatus(user, 'o1', OrderStatus.PROCESSING),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOrder', () => {
    it('should return order for owner customer', async () => {
      const order = {
        id: 'o1',
        customerId: 'user-1',
        shopId: 'shop-1',
        status: OrderStatus.PAID,
        items: [],
        shop: { id: 'shop-1', name: 'Shop', status: 'ACTIVE' },
        customer: { id: 'user-1', name: 'Buyer', email: 'b@demo.com' },
        statusHistory: [],
        payments: [],
        paymentTokenHash: null,
        paymentTokenExpiresAt: null,
      };

      mockPrisma.order.findUnique.mockResolvedValue(order);

      const user: JwtPayload = {
        sub: 'user-1',
        email: 'b@demo.com',
        role: UserRole.CUSTOMER,
        shopId: null,
      };
      const result = await service.getOrder(user, 'o1');

      expect(result.id).toBe('o1');
      expect((result as { paymentTokenHash?: string }).paymentTokenHash).toBeUndefined();
    });

    it('should throw NotFoundException if missing', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.getOrder(null, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
