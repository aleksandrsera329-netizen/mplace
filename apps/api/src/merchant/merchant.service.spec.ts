import { OrderStatus, RfqOfferStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { LedgerService } from '../finance/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantService } from './merchant.service';

describe('MerchantService (Stage 15)', () => {
  let service: MerchantService;

  const mockPrisma = {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    product: { count: jest.fn() },
    payoutRequest: { aggregate: jest.fn() },
    rfqOffer: { count: jest.fn(), findMany: jest.fn() },
    rfqMatch: { findMany: jest.fn() },
    kycDocument: { count: jest.fn(), findMany: jest.fn() },
    shop: { findUnique: jest.fn() },
  };

  const mockLedger = {
    getAvailableBalance: jest.fn().mockResolvedValue(42_000),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedger },
      ],
    }).compile();
    service = mod.get(MerchantService);
    jest.clearAllMocks();
    mockLedger.getAvailableBalance.mockResolvedValue(42_000);
  });

  it('getDashboard computes GMV and vendor revenue', async () => {
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { totalCents: 100_000, commissionCents: 10_000 },
    });
    mockPrisma.order.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(8);
    mockPrisma.product.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(10);
    mockPrisma.payoutRequest.aggregate.mockResolvedValue({
      _sum: { amountCents: 5_000 },
    });
    mockPrisma.rfqOffer.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.rfqOffer.findMany.mockResolvedValue([]);
    mockPrisma.kycDocument.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: 'shop-1',
      name: 'Test',
      verified: true,
    });

    const dash = await service.getDashboard('shop-1');

    expect(dash.stats.gmvCents).toBe(100_000);
    expect(dash.stats.commissionCents).toBe(10_000);
    expect(dash.stats.revenueCents).toBe(90_000);
    expect(dash.stats.availableBalanceCents).toBe(42_000);
    expect(dash.stats.pendingPayoutsCents).toBe(5_000);
    expect(dash.stats.openOffers).toBe(3);
    expect(mockPrisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shopId: 'shop-1',
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
              OrderStatus.COMPLETED,
            ],
          },
        }),
      }),
    );
    expect(mockLedger.getAvailableBalance).toHaveBeenCalledWith('shop-1');
  });

  it('getOrders scopes to shopId and active filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    await service.getOrders('shop-1', 'active');
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId: 'shop-1',
          status: {
            in: [
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.PAID,
              OrderStatus.PROCESSING,
            ],
          },
        },
      }),
    );
  });

  it('getRfqs pending filters offer status', async () => {
    mockPrisma.rfqOffer.findMany.mockResolvedValue([]);
    await service.getRfqs('shop-1', 'pending');
    expect(mockPrisma.rfqOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId: 'shop-1',
          status: RfqOfferStatus.PENDING,
        },
      }),
    );
  });
});
