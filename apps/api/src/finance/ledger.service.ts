import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AccountType,
  EntryDirection,
  FinancialTransactionStatus,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LedgerEntryInput = {
  account: AccountType;
  shopId?: string | null;
  direction: EntryDirection;
  amountCents: number;
};

export type PostTransactionParams = {
  type: FinancialTransactionType;
  referenceType: string;
  referenceId: string;
  currency?: string;
  description?: string;
  entries: LedgerEntryInput[];
  /** When set, runs inside this transaction client */
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomic double-entry post. Guarantees sum(debits) === sum(credits).
   * Idempotent: same type + referenceType + referenceId + POSTED returns existing.
   */
  async postTransaction(params: PostTransactionParams) {
    const currency = (params.currency || 'USD').toUpperCase();
    const entries = params.entries;

    this.assertBalanced(entries);

    const db = params.tx || this.prisma;

    const existing = await db.financialTransaction.findFirst({
      where: {
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        status: FinancialTransactionStatus.POSTED,
      },
      include: { entries: true },
    });
    if (existing) {
      this.logger.debug(
        `Ledger already posted ${params.type} ${params.referenceType}:${params.referenceId}`,
      );
      return existing;
    }

    const create = async (client: Prisma.TransactionClient) => {
      return client.financialTransaction.create({
        data: {
          type: params.type,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          currency,
          status: FinancialTransactionStatus.POSTED,
          description: params.description ?? null,
          postedAt: new Date(),
          entries: {
            create: entries.map((e) => ({
              account: e.account,
              shopId: e.shopId || null,
              direction: e.direction,
              amountCents: e.amountCents,
              currency,
            })),
          },
        },
        include: { entries: true },
      });
    };

    if (params.tx) {
      return create(params.tx);
    }
    return this.prisma.$transaction((tx) => create(tx));
  }

  assertBalanced(entries: LedgerEntryInput[]) {
    if (!entries?.length) {
      throw new BadRequestException('Ledger entries required');
    }
    if (entries.some((e) => !Number.isFinite(e.amountCents) || e.amountCents <= 0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const debits = entries
      .filter((e) => e.direction === EntryDirection.DEBIT)
      .reduce((s, e) => s + e.amountCents, 0);
    const credits = entries
      .filter((e) => e.direction === EntryDirection.CREDIT)
      .reduce((s, e) => s + e.amountCents, 0);

    if (debits !== credits) {
      throw new BadRequestException(
        `Ledger invariant violated: debits=${debits}, credits=${credits}`,
      );
    }
  }

  /**
   * Payment received: clearing DEBIT total;
   * vendor CREDIT (total - commission); commission CREDIT.
   */
  async postPayment(params: {
    orderId: string;
    amountCents: number;
    commissionCents: number;
    shopId: string;
    currency?: string;
    description?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const amount = Math.round(params.amountCents);
    let commission = Math.max(0, Math.round(params.commissionCents));
    if (commission > amount) commission = amount;
    const vendorAmount = amount - commission;

    const entries: LedgerEntryInput[] = [
      {
        account: AccountType.PLATFORM_CLEARING,
        direction: EntryDirection.DEBIT,
        amountCents: amount,
      },
    ];
    if (vendorAmount > 0) {
      entries.push({
        account: AccountType.VENDOR_PAYABLE,
        shopId: params.shopId,
        direction: EntryDirection.CREDIT,
        amountCents: vendorAmount,
      });
    }
    if (commission > 0) {
      entries.push({
        account: AccountType.PLATFORM_COMMISSION,
        direction: EntryDirection.CREDIT,
        amountCents: commission,
      });
    }
    // edge: full commission (vendor 0) — only clearing + commission
    // edge: zero commission — clearing + vendor only

    return this.postTransaction({
      type: FinancialTransactionType.PAYMENT,
      referenceType: 'Order',
      referenceId: params.orderId,
      currency: params.currency,
      description:
        params.description || `Payment for order ${params.orderId}`,
      entries,
      tx: params.tx,
    });
  }

  /**
   * Refund: reverse payment (clearing CREDIT; vendor + commission DEBIT).
   */
  async postRefund(params: {
    refundId: string;
    amountCents: number;
    commissionCents: number;
    shopId: string;
    currency?: string;
    description?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const amount = Math.round(params.amountCents);
    let commission = Math.max(0, Math.round(params.commissionCents));
    if (commission > amount) commission = amount;
    const vendorAmount = amount - commission;

    const entries: LedgerEntryInput[] = [
      {
        account: AccountType.PLATFORM_CLEARING,
        direction: EntryDirection.CREDIT,
        amountCents: amount,
      },
    ];
    if (vendorAmount > 0) {
      entries.push({
        account: AccountType.VENDOR_PAYABLE,
        shopId: params.shopId,
        direction: EntryDirection.DEBIT,
        amountCents: vendorAmount,
      });
    }
    if (commission > 0) {
      entries.push({
        account: AccountType.PLATFORM_COMMISSION,
        direction: EntryDirection.DEBIT,
        amountCents: commission,
      });
    }

    return this.postTransaction({
      type: FinancialTransactionType.REFUND,
      referenceType: 'Refund',
      referenceId: params.refundId,
      currency: params.currency,
      description: params.description || `Refund ${params.refundId}`,
      entries,
      tx: params.tx,
    });
  }

  /**
   * Vendor payable net balance:
   * CREDIT(VENDOR_PAYABLE) − DEBIT(VENDOR_PAYABLE)
   * Payout reserve posts DEBIT here → available drops atomically.
   */
  async vendorPayableBalanceCents(
    shopId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx || this.prisma;
    const entries = await db.financialEntry.findMany({
      where: {
        shopId,
        account: AccountType.VENDOR_PAYABLE,
        transaction: { status: FinancialTransactionStatus.POSTED },
      },
      select: { direction: true, amountCents: true },
    });
    let bal = 0;
    for (const e of entries) {
      if (e.direction === EntryDirection.CREDIT) bal += e.amountCents;
      else bal -= e.amountCents;
    }
    return bal;
  }

  /**
   * Available for payout = VENDOR_PAYABLE net (reserves already deducted).
   * Falls back to legacy LedgerEntry + open payout holds when no DE entries.
   */
  async getAvailableBalance(
    shopId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx || this.prisma;
    const deCount = await db.financialEntry.count({
      where: { shopId, account: AccountType.VENDOR_PAYABLE },
    });
    if (deCount > 0) {
      return Math.max(0, await this.vendorPayableBalanceCents(shopId, tx));
    }

    // Legacy path: earnings − payouts − open requests
    const entries = await db.ledgerEntry.findMany({
      where: { shopId, account: 'VENDOR' },
    });
    const earned = entries
      .filter((e) => e.entryType === 'VENDOR_EARNING')
      .reduce((s, e) => s + e.amountCents, 0);
    const paidOut = entries
      .filter((e) => e.entryType === 'PAYOUT')
      .reduce((s, e) => s + Math.abs(e.amountCents), 0);
    const open = await db.payoutRequest.aggregate({
      where: {
        shopId,
        status: {
          in: [
            'PENDING',
            'RESERVED',
            'PROCESSING',
            'APPROVED',
          ] as never,
        },
      },
      _sum: { amountCents: true },
    });
    const held = open._sum.amountCents ?? 0;
    return Math.max(0, earned - paidOut - held);
  }

  /**
   * Reserve funds for payout: DEBIT VENDOR_PAYABLE, CREDIT VENDOR_AVAILABLE.
   */
  async postPayoutReserve(params: {
    payoutId: string;
    shopId: string;
    amountCents: number;
    currency?: string;
    tx?: Prisma.TransactionClient;
  }) {
    return this.postTransaction({
      type: FinancialTransactionType.PAYOUT,
      referenceType: 'Payout',
      referenceId: params.payoutId,
      currency: params.currency,
      description: `Payout reserve ${params.payoutId}`,
      entries: [
        {
          account: AccountType.VENDOR_PAYABLE,
          shopId: params.shopId,
          direction: EntryDirection.DEBIT,
          amountCents: params.amountCents,
        },
        {
          account: AccountType.VENDOR_AVAILABLE,
          shopId: params.shopId,
          direction: EntryDirection.CREDIT,
          amountCents: params.amountCents,
        },
      ],
      tx: params.tx,
    });
  }

  /**
   * Release reserve on FAILED/CANCELLED: reverse of reserve.
   */
  async releasePayoutReserve(params: {
    payoutId: string;
    shopId: string;
    amountCents: number;
    currency?: string;
    tx?: Prisma.TransactionClient;
  }) {
    return this.postTransaction({
      type: FinancialTransactionType.PAYOUT,
      referenceType: 'PayoutRelease',
      referenceId: params.payoutId,
      currency: params.currency,
      description: `Payout reserve release ${params.payoutId}`,
      entries: [
        {
          account: AccountType.VENDOR_AVAILABLE,
          shopId: params.shopId,
          direction: EntryDirection.DEBIT,
          amountCents: params.amountCents,
        },
        {
          account: AccountType.VENDOR_PAYABLE,
          shopId: params.shopId,
          direction: EntryDirection.CREDIT,
          amountCents: params.amountCents,
        },
      ],
      tx: params.tx,
    });
  }

  /**
   * Finalize completed payout: move from VENDOR_AVAILABLE out via PLATFORM_CLEARING.
   */
  async postPayoutCompleted(params: {
    payoutId: string;
    shopId: string;
    amountCents: number;
    currency?: string;
    tx?: Prisma.TransactionClient;
  }) {
    return this.postTransaction({
      type: FinancialTransactionType.PAYOUT,
      referenceType: 'PayoutComplete',
      referenceId: params.payoutId,
      currency: params.currency,
      description: `Payout completed ${params.payoutId}`,
      entries: [
        {
          account: AccountType.VENDOR_AVAILABLE,
          shopId: params.shopId,
          direction: EntryDirection.DEBIT,
          amountCents: params.amountCents,
        },
        {
          account: AccountType.PLATFORM_CLEARING,
          direction: EntryDirection.CREDIT,
          amountCents: params.amountCents,
        },
      ],
      tx: params.tx,
    });
  }
}
