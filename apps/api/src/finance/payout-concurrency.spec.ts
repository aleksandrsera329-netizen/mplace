import { BadRequestException } from '@nestjs/common';
import {
  AccountType,
  EntryDirection,
  FinancialTransactionStatus,
  FinancialTransactionType,
  PayoutStatus,
  PrismaClient,
  ShopStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { LedgerService } from './ledger.service';
import { FinanceService } from './finance.service';

/**
 * Stage 10 integration: concurrent payouts against real PostgreSQL.
 * Requires DATABASE_URL (same as app).
 */
describe('Payout concurrency (Stage 10)', () => {
  const prisma = new PrismaClient();
  let finance: FinanceService;
  let shopId: string;

  beforeAll(async () => {
    // minimal domain event stub
    const events = { emit: jest.fn() };
    const ledger = new LedgerService(prisma as never);
    const slog = {
      child: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    };
    const metrics = {
      incPayoutFailed: jest.fn(),
    };
    finance = new FinanceService(
      prisma as never,
      events as never,
      ledger,
      slog as never,
      metrics as never,
    );

    const shop = await prisma.shop.create({
      data: {
        name: `Payout Concurrent ${randomUUID().slice(0, 8)}`,
        slug: `payout-c-${randomUUID().slice(0, 8)}`,
        status: ShopStatus.ACTIVE,
        verified: true,
      },
    });
    shopId = shop.id;

    // Seed available balance = 1000 via double-entry PAYMENT
    await prisma.financialTransaction.create({
      data: {
        type: FinancialTransactionType.PAYMENT,
        referenceType: 'Order',
        referenceId: `seed-${shopId}`,
        currency: 'USD',
        status: FinancialTransactionStatus.POSTED,
        postedAt: new Date(),
        description: 'concurrency seed',
        entries: {
          create: [
            {
              account: AccountType.PLATFORM_CLEARING,
              direction: EntryDirection.DEBIT,
              amountCents: 1000,
              currency: 'USD',
            },
            {
              account: AccountType.VENDOR_PAYABLE,
              shopId,
              direction: EntryDirection.CREDIT,
              amountCents: 1000,
              currency: 'USD',
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    try {
      const payouts = await prisma.payoutRequest.findMany({
        where: { shopId },
        select: { id: true },
      });
      const payoutIds = payouts.map((p) => p.id);
      await prisma.financialEntry.deleteMany({ where: { shopId } });
      await prisma.financialTransaction.deleteMany({
        where: {
          OR: [
            { referenceId: `seed-${shopId}` },
            { referenceId: { in: payoutIds } },
          ],
        },
      });
      await prisma.ledgerEntry.deleteMany({ where: { shopId } });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: 'PayoutRequest',
          entityId: { in: payoutIds },
        },
      });
      await prisma.payoutRequest.deleteMany({ where: { shopId } });
      await prisma.shop.delete({ where: { id: shopId } });
    } catch {
      /* best-effort cleanup */
    }
    await prisma.$disconnect();
  });

  it('prevents double-spend on concurrent payouts (800+800 on 1000)', async () => {
    const availableBefore = await finance.shopBalance(shopId);
    expect(availableBefore.availableCents).toBe(1000);

    const [resultA, resultB] = await Promise.allSettled([
      finance.requestPayoutAtomic(shopId, 800),
      finance.requestPayoutAtomic(shopId, 800),
    ]);

    const success = [resultA, resultB].filter((r) => r.status === 'fulfilled');
    const failed = [resultA, resultB].filter((r) => r.status === 'rejected');

    if (success.length !== 1 || failed.length !== 1) {
      // help debug if both fail
      // eslint-disable-next-line no-console
      console.error('A', resultA);
      // eslint-disable-next-line no-console
      console.error('B', resultB);
    }

    expect(success).toHaveLength(1);
    expect(failed).toHaveLength(1);

    if (failed[0].status === 'rejected') {
      const reason = failed[0].reason;
      expect(
        reason instanceof BadRequestException ||
          String(reason).includes('Insufficient'),
      ).toBe(true);
    }

    const reserved = await prisma.payoutRequest.findMany({
      where: { shopId, status: PayoutStatus.RESERVED },
    });
    expect(reserved).toHaveLength(1);
    expect(reserved[0].amountCents).toBe(800);

    const bal = await finance.shopBalance(shopId);
    expect(bal.availableCents).toBe(200);
  });

  it('releases reserve on failPayout', async () => {
    const open = await prisma.payoutRequest.findMany({
      where: {
        shopId,
        status: { in: [PayoutStatus.RESERVED, PayoutStatus.PROCESSING] },
      },
    });
    for (const p of open) {
      await finance.failPayout(p.id, 'test cleanup');
    }

    const afterRelease = await finance.shopBalance(shopId);
    expect(afterRelease.availableCents).toBe(1000);

    const payout = await finance.requestPayoutAtomic(shopId, 500);
    expect(payout.status).toBe(PayoutStatus.RESERVED);
    expect((await finance.shopBalance(shopId)).availableCents).toBe(500);

    await finance.failPayout(payout.id, 'provider error');
    const failed = await prisma.payoutRequest.findUnique({
      where: { id: payout.id },
    });
    expect(failed?.status).toBe(PayoutStatus.FAILED);
    expect((await finance.shopBalance(shopId)).availableCents).toBe(1000);
  });
});
