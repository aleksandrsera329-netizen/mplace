import { OrderStatus, RfqStatus, UserRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BuyerService } from './buyer.service';

describe('BuyerService (Stage 14)', () => {
  let service: BuyerService;

  const mockPrisma = {
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    rfqRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    wishlistItem: {
      count: jest.fn(),
    },
    notification: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        BuyerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(BuyerService);
    jest.clearAllMocks();
  });

  it('getDashboard aggregates only buyer data', async () => {
    mockPrisma.order.count.mockResolvedValue(3);
    mockPrisma.rfqRequest.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'o1', customerId: 'buyer-1', status: OrderStatus.PAID },
    ]);
    mockPrisma.wishlistItem.count.mockResolvedValue(5);
    mockPrisma.rfqRequest.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(4);

    const dash = await service.getDashboard('buyer-1');

    expect(dash.stats.activeOrders).toBe(3);
    expect(dash.stats.pendingRfqs).toBe(2);
    expect(dash.stats.wishlistCount).toBe(5);
    expect(dash.stats.unreadNotifications).toBe(4);
    expect(mockPrisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: 'buyer-1' }),
      }),
    );
    expect(mockPrisma.rfqRequest.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buyerId: 'buyer-1' }),
      }),
    );
  });

  it('getOrders filters active statuses', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    await service.getOrders('buyer-1', 'active');
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerId: 'buyer-1',
          status: {
            in: [
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.PAID,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
            ],
          },
        },
      }),
    );
  });

  it('getRfqs filters awarded', async () => {
    mockPrisma.rfqRequest.findMany.mockResolvedValue([]);
    await service.getRfqs('buyer-1', 'awarded');
    expect(mockPrisma.rfqRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          buyerId: 'buyer-1',
          status: { in: [RfqStatus.AWARDED, RfqStatus.CLOSED] },
        },
      }),
    );
  });
});
