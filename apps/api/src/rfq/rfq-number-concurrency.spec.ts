import {
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RfqService } from './rfq.service';

describe('RFQ number concurrency (Stage 13)', () => {
  const prisma = new PrismaClient();
  let rfqService: RfqService;
  let buyerId: string;

  beforeAll(async () => {
    // Ensure sequence exists (idempotent)
    await prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START WITH 1 INCREMENT BY 1`,
    );

    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const events = { emit: jest.fn() };
    const slog = {
      child: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    };
    rfqService = new RfqService(
      prisma as never,
      audit as never,
      events as never,
      slog as never,
    );

    const suffix = randomUUID().slice(0, 8);
    const buyer = await prisma.user.create({
      data: {
        email: `rfq-num-${suffix}@test.local`,
        passwordHash: await bcrypt.hash('x', 10),
        name: 'RFQ Number Buyer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    buyerId = buyer.id;
  });

  afterAll(async () => {
    try {
      const rfqs = await prisma.rfqRequest.findMany({
        where: { buyerId },
        select: { id: true },
      });
      const ids = rfqs.map((r) => r.id);
      await prisma.rfqItem.deleteMany({ where: { rfqId: { in: ids } } });
      await prisma.rfqMatch.deleteMany({ where: { rfqId: { in: ids } } });
      await prisma.rfqRequest.deleteMany({ where: { buyerId } });
      await prisma.user.delete({ where: { id: buyerId } });
    } catch {
      /* cleanup */
    }
    await prisma.$disconnect();
  });

  it('parallel create of 10 RFQs yields unique numbers', async () => {
    const user = {
      sub: buyerId,
      email: 'x@y.z',
      role: UserRole.CUSTOMER,
      shopId: null,
    } as const;

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        rfqService.create(user as never, {
          title: `Parallel RFQ ${i}`,
          items: [{ name: 'Item', quantity: 1 }],
        }),
      ),
    );

    const numbers = results.map((r) => r.number);
    expect(numbers).toHaveLength(10);
    expect(new Set(numbers).size).toBe(10);

    // Sequence format RFQ-YYYY-#####
    for (const n of numbers) {
      expect(n).toMatch(/^RFQ-\d{4}-\d{5}$/);
    }

    // DB unique
    const rows = await prisma.rfqRequest.findMany({
      where: { id: { in: results.map((r) => r.id) } },
      select: { number: true },
    });
    expect(new Set(rows.map((r) => r.number)).size).toBe(10);
  });
});
