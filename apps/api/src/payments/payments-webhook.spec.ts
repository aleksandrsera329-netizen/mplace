import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { DomainEventService } from '../events/domain-event.service';
import { MetricsService } from '../metrics/metrics.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../finance/ledger.service';
import { RefundsService } from '../refunds/refunds.service';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';

describe('PaymentsService Stripe webhook idempotency (Stage 7)', () => {
  let service: PaymentsService;

  const mockPrisma = {
    paymentWebhookEvent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    dispute: {
      create: jest.fn(),
    },
    shop: {
      findFirst: jest.fn(),
    },
  };

  const mockRefunds = {
    confirmProviderRefund: jest.fn().mockResolvedValue({ ok: true }),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_x';
      if (key === 'PAYMENT_PROVIDER') return 'stripe';
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  };

  const mockOrders = {
    completePaidOrder: jest.fn(),
  };

  const mockStripeConnect = {
    syncAccountStatus: jest.fn(),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrdersService, useValue: mockOrders },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StripeConnectService, useValue: mockStripeConnect },
        { provide: AuditService, useValue: mockAudit },
        { provide: RefundsService, useValue: mockRefunds },
        {
          provide: LedgerService,
          useValue: { postPayment: jest.fn(), postRefund: jest.fn() },
        },
        {
          provide: DomainEventService,
          useValue: { emit: jest.fn() },
        },
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
        {
          provide: MetricsService,
          useValue: {
            incPaymentFailed: jest.fn(),
            incPaymentSucceeded: jest.fn(),
            incWebhookFailed: jest.fn(),
            incWebhookProcessed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    jest.clearAllMocks();
  });

  describe('processVerifiedStripeEvent', () => {
    it('processes payment_intent.succeeded once and marks processed', async () => {
      mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhookEvent.upsert.mockResolvedValue({
        id: 'whe-1',
        status: 'received',
      });
      mockPrisma.paymentWebhookEvent.update.mockResolvedValue({});

      // completeStripeSucceeded path: payment found already SUCCEEDED → already
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        orderId: 'ord-1',
        status: PaymentStatus.SUCCEEDED,
        amountCents: 1000,
        currency: 'USD',
        order: { id: 'ord-1', totalCents: 1000, currency: 'USD' },
      });

      const event = {
        id: 'evt_success_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            amount_received: 1000,
            currency: 'usd',
            metadata: { orderId: 'ord-1' },
          },
        },
      };

      const result = await service.processVerifiedStripeEvent(
        event,
        Buffer.from('{}'),
      );

      expect(result).toMatchObject({
        received: true,
        status: 'processed',
        eventId: 'evt_success_1',
      });
      expect(mockPrisma.paymentWebhookEvent.upsert).toHaveBeenCalled();
      expect(mockPrisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whe-1' },
          data: expect.objectContaining({ status: 'processed' }),
        }),
      );
    });

    it('returns already_processed for duplicate event id', async () => {
      mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue({
        id: 'whe-1',
        status: 'processed',
        externalId: 'evt_dup',
      });

      const result = await service.processVerifiedStripeEvent({
        id: 'evt_dup',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1', metadata: { orderId: 'o1' } } },
      });

      expect(result).toMatchObject({
        received: true,
        status: 'already_processed',
      });
      expect(mockPrisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
    });

    it('marks ignored for unknown event types', async () => {
      mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhookEvent.upsert.mockResolvedValue({
        id: 'whe-ign',
      });
      mockPrisma.paymentWebhookEvent.update.mockResolvedValue({});

      const result = await service.processVerifiedStripeEvent({
        id: 'evt_unknown',
        type: 'customer.created',
        data: { object: {} },
      });

      expect(result.status).toBe('ignored');
      expect(mockPrisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ignored' }),
        }),
      );
    });

    it('marks failed and rethrows when handler throws', async () => {
      mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhookEvent.upsert.mockResolvedValue({
        id: 'whe-fail',
      });
      mockPrisma.paymentWebhookEvent.update.mockResolvedValue({});

      // Force handler error via account.updated with prisma throw
      mockStripeConnect.syncAccountStatus.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.processVerifiedStripeEvent({
          id: 'evt_fail',
          type: 'account.updated',
          data: {
            object: { id: 'acct_1', metadata: { shopId: 'shop-1' } },
          },
        }),
      ).rejects.toThrow('db down');

      expect(mockPrisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: expect.stringContaining('db down'),
          }),
        }),
      );
    });
  });

  describe('handleStripeWebhook signature', () => {
    it('rejects missing signature', async () => {
      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid signature (constructEvent throws)', async () => {
      // Real Stripe constructEvent will fail on bad sig
      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
