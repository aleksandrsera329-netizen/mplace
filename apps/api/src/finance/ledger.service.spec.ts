import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AccountType,
  EntryDirection,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';

describe('LedgerService (Stage 9)', () => {
  let service: LedgerService;

  const mockPrisma = {
    financialTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    financialEntry: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    ),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(LedgerService);
    jest.clearAllMocks();
    mockPrisma.financialTransaction.findFirst.mockResolvedValue(null);
  });

  it('maintains debit = credit (rejects unbalanced)', async () => {
    await expect(
      service.postTransaction({
        type: FinancialTransactionType.PAYMENT,
        referenceType: 'Order',
        referenceId: 'test',
        entries: [
          {
            account: AccountType.PLATFORM_CLEARING,
            direction: EntryDirection.DEBIT,
            amountCents: 10000,
          },
          {
            account: AccountType.VENDOR_PAYABLE,
            direction: EntryDirection.CREDIT,
            amountCents: 9000,
          },
          // missing commission 1000
        ],
      }),
    ).rejects.toThrow(/Ledger invariant violated/);
    expect(mockPrisma.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.postTransaction({
        type: FinancialTransactionType.PAYMENT,
        referenceType: 'Order',
        referenceId: 't',
        entries: [
          {
            account: AccountType.PLATFORM_CLEARING,
            direction: EntryDirection.DEBIT,
            amountCents: 0,
          },
          {
            account: AccountType.VENDOR_PAYABLE,
            direction: EntryDirection.CREDIT,
            amountCents: 0,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('posts balanced payment with commission', async () => {
    mockPrisma.financialTransaction.create.mockResolvedValue({
      id: 'ft-1',
      type: FinancialTransactionType.PAYMENT,
      status: FinancialTransactionStatus.POSTED,
      entries: [],
    });

    await service.postPayment({
      orderId: 'ord-1',
      amountCents: 10000,
      commissionCents: 1000,
      shopId: 'shop-1',
    });

    expect(mockPrisma.financialTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: FinancialTransactionType.PAYMENT,
          referenceId: 'ord-1',
          status: FinancialTransactionStatus.POSTED,
          entries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                account: AccountType.PLATFORM_CLEARING,
                direction: EntryDirection.DEBIT,
                amountCents: 10000,
              }),
              expect.objectContaining({
                account: AccountType.VENDOR_PAYABLE,
                shopId: 'shop-1',
                direction: EntryDirection.CREDIT,
                amountCents: 9000,
              }),
              expect.objectContaining({
                account: AccountType.PLATFORM_COMMISSION,
                direction: EntryDirection.CREDIT,
                amountCents: 1000,
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('is idempotent for same reference', async () => {
    mockPrisma.financialTransaction.findFirst.mockResolvedValue({
      id: 'ft-existing',
      status: FinancialTransactionStatus.POSTED,
      entries: [],
    });

    const r = await service.postPayment({
      orderId: 'ord-1',
      amountCents: 100,
      commissionCents: 10,
      shopId: 's1',
    });
    expect(r.id).toBe('ft-existing');
    expect(mockPrisma.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('postRefund balances reverse entries', async () => {
    mockPrisma.financialTransaction.create.mockResolvedValue({
      id: 'ft-r',
      entries: [],
    });

    await service.postRefund({
      refundId: 'rf-1',
      amountCents: 5000,
      commissionCents: 500,
      shopId: 'shop-1',
    });

    const createArg = mockPrisma.financialTransaction.create.mock.calls[0][0];
    const created = createArg.data.entries.create as Array<{
      direction: EntryDirection;
      amountCents: number;
    }>;
    const debits = created
      .filter((e) => e.direction === EntryDirection.DEBIT)
      .reduce((s, e) => s + e.amountCents, 0);
    const credits = created
      .filter((e) => e.direction === EntryDirection.CREDIT)
      .reduce((s, e) => s + e.amountCents, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(5000);
  });
});
