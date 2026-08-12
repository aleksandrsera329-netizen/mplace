import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { LedgerService } from '../finance/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundsService } from './refunds.service';

describe('RefundsService (Stage 8)', () => {
  let service: RefundsService;

  const mockPrisma = {
    order: { findUnique: jest.fn() },
    refund: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    payment: { findFirst: jest.fn() },
    ledgerEntry: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    ),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockConfig = {
    get: jest.fn((k: string) =>
      k === 'PAYMENT_PROVIDER' ? 'stripe' : null,
    ),
  };
  const mockLedger = {
    postRefund: jest.fn().mockResolvedValue({ id: 'ft-r' }),
    postPayment: jest.fn(),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
        { provide: LedgerService, useValue: mockLedger },
        {
          provide: StructuredLogger,
          useValue: {
            child: () => ({
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            }),
          },
        },
      ],
    }).compile();
    service = mod.get(RefundsService);
    jest.clearAllMocks();
    mockPrisma.refund.aggregate.mockResolvedValue({
      _sum: { amountCents: 0 },
    });
    mockLedger.postRefund.mockResolvedValue({ id: 'ft-r' });
  });

  const admin = {
    sub: 'admin-1',
    role: UserRole.ADMIN,
    email: 'a@x.com',
    shopId: null,
  };

  it('requestRefund creates REQUESTED only', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'admin-1',
      shopId: 'shop-1',
      status: OrderStatus.PAID,
      totalCents: 1000,
      currency: 'USD',
      payments: [
        { status: PaymentStatus.SUCCEEDED, amountCents: 1000, provider: 'stripe' },
      ],
    });
    mockPrisma.refund.create.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.REQUESTED,
      amountCents: 500,
    });

    const r = await service.requestRefund(admin, 'ord-1', 500, 'oops');
    expect(r.status).toBe(RefundStatus.REQUESTED);
    expect(mockPrisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RefundStatus.REQUESTED,
          amountCents: 500,
        }),
      }),
    );
  });

  it('rejects refund amount over remaining (duplicate / over-refund guard)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'admin-1',
      shopId: 'shop-1',
      status: OrderStatus.PAID,
      totalCents: 1000,
      currency: 'USD',
      payments: [
        { status: PaymentStatus.SUCCEEDED, amountCents: 1000, provider: 'stripe' },
      ],
    });
    // already refunded 800 → max 200
    mockPrisma.refund.aggregate.mockResolvedValue({
      _sum: { amountCents: 800 },
    });

    await expect(
      service.requestRefund(admin, 'ord-1', 500, 'too much'),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.refund.create).not.toHaveBeenCalled();
  });

  it('approveRefund does not set COMPLETED', async () => {
    mockPrisma.refund.findUnique.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.REQUESTED,
      order: { id: 'ord-1' },
    });
    mockPrisma.refund.update.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.APPROVED,
    });

    const r = await service.approveRefund('rf-1', 'admin-1');
    expect(r.status).toBe(RefundStatus.APPROVED);
    expect(mockPrisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.APPROVED }),
      }),
    );
  });

  it('approveRefund rejects non-REQUESTED', async () => {
    mockPrisma.refund.findUnique.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.COMPLETED,
      order: { id: 'ord-1' },
    });
    await expect(service.approveRefund('rf-1', 'a')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('confirmProviderRefund is idempotent when already COMPLETED', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.COMPLETED,
      order: { id: 'ord-1', totalCents: 1000, shopId: 's1', currency: 'USD' },
      amountCents: 1000,
    });
    // findUnique for meta path null
    mockPrisma.refund.findUnique.mockResolvedValue(null);

    const r = await service.confirmProviderRefund({
      stripeRefundId: 're_1',
      orderId: 'ord-1',
    });
    expect(r).toMatchObject({ ok: true, already: true });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('confirmProviderRefund completes PROVIDER_REQUESTED and writes ledger', async () => {
    mockPrisma.refund.findUnique.mockResolvedValue(null);
    mockPrisma.refund.findFirst.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.PROVIDER_REQUESTED,
      amountCents: 1000,
      currency: 'USD',
      orderId: 'ord-1',
      order: {
        id: 'ord-1',
        totalCents: 1000,
        shopId: 'shop-1',
        currency: 'USD',
        status: OrderStatus.PAID,
      },
    });
    mockPrisma.refund.update.mockResolvedValue({});
    mockPrisma.order = {
      ...mockPrisma.order,
      update: jest.fn().mockResolvedValue({}),
    };
    mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null);
    mockPrisma.ledgerEntry.create.mockResolvedValue({});
    mockPrisma.order.findUnique.mockResolvedValue({
      commissionCents: 100,
      totalCents: 1000,
    });

    const r = await service.confirmProviderRefund({
      stripeRefundId: 're_abc',
      orderId: 'ord-1',
      amountCents: 1000,
    });

    expect(r).toMatchObject({ ok: true, status: RefundStatus.COMPLETED });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.ledgerEntry.create).toHaveBeenCalled();
    expect(mockLedger.postRefund).toHaveBeenCalled();
  });
});
