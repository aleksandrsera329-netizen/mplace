import { ForbiddenException } from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileSecurityService } from '../common/upload/file-security.service';
import { QueueProducer } from '../queue/queue.producer';
import { SearchService } from '../search/search.service';
import { MerchantProductsService } from './merchant-products.service';

jest.mock('meilisearch', () => ({
  Meilisearch: class {
    index() {
      return {
        addDocuments: jest.fn(),
        deleteDocument: jest.fn(),
        search: jest.fn(),
      };
    }
  },
}));

describe('MerchantProductsService (Stage 16)', () => {
  let service: MerchantProductsService;

  const mockPrisma = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    shop: { findUnique: jest.fn() },
    category: { findFirst: jest.fn() },
    productImportJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockSearch = {
    indexProduct: jest.fn().mockResolvedValue(undefined),
    removeProduct: jest.fn().mockResolvedValue(undefined),
  };
  const mockQueues = {
    enqueueImport: jest.fn().mockResolvedValue({ queued: true, jobId: 'jq-1' }),
    enqueueSearchIndex: jest.fn().mockResolvedValue({ queued: false }),
    enqueueEmail: jest.fn(),
  };

  const merchant = {
    sub: 'u1',
    email: 'm@t.com',
    role: UserRole.MERCHANT,
    shopId: 'shop-1',
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        MerchantProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SearchService, useValue: mockSearch },
        { provide: QueueProducer, useValue: mockQueues },
        {
          provide: FileSecurityService,
          useValue: {
            assertSafe: jest.fn().mockResolvedValue({
              safeOriginalName: 'import.csv',
              storageKeyName: 'uuid.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('a,b\n'),
              sizeBytes: 4,
            }),
            applySafeMeta: jest.fn((f: Express.Multer.File) => f),
          },
        },
      ],
    }).compile();
    service = mod.get(MerchantProductsService);
    jest.clearAllMocks();
    mockQueues.enqueueImport.mockResolvedValue({ queued: true, jobId: 'jq-1' });
    mockQueues.enqueueSearchIndex.mockResolvedValue({ queued: false });
  });

  it('rejects non-merchant', async () => {
    await expect(
      service.list({
        sub: 'x',
        role: UserRole.CUSTOMER,
        shopId: null,
        email: 'c@t.com',
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create scopes to shop and defaults DRAFT', async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: 'shop-1',
      status: 'PENDING',
    });
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({
      id: 'p1',
      shopId: 'shop-1',
      name: 'Valve',
      status: ProductStatus.DRAFT,
      priceCents: 1000,
    });

    const p = await service.create(merchant as never, {
      name: 'Valve',
      priceCents: 1000,
      status: ProductStatus.ACTIVE, // forced draft if shop not ACTIVE
    } as never);

    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 'shop-1',
          status: ProductStatus.DRAFT,
        }),
      }),
    );
    expect(p.id).toBe('p1');
  });

  it('bulkUpdate only touches own products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    mockPrisma.product.updateMany.mockResolvedValue({ count: 2 });

    const r = await service.bulkUpdate(
      merchant as never,
      ['a', 'b', 'foreign'],
      { status: ProductStatus.ARCHIVED },
    );
    expect(r.updated).toBe(2);
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1', id: { in: ['a', 'b'] } },
      }),
    );
  });

  it('duplicate creates DRAFT copy', async () => {
    mockPrisma.product.findFirst
      .mockResolvedValueOnce({
        id: 'src',
        shopId: 'shop-1',
        name: 'Pump',
        slug: 'pump',
        sku: 'SKU1',
        description: null,
        gtin: null,
        priceCents: 5000,
        currency: 'USD',
        stock: 3,
        categoryId: null,
        imageUrl: null,
      })
      .mockResolvedValueOnce(null); // unique slug
    mockPrisma.product.create.mockResolvedValue({
      id: 'copy',
      status: ProductStatus.DRAFT,
      name: 'Pump (copy)',
    });

    const p = await service.duplicate(merchant as never, 'src');
    expect(p.status).toBe(ProductStatus.DRAFT);
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductStatus.DRAFT,
          name: 'Pump (copy)',
        }),
      }),
    );
  });

  it('confirmImport enqueues background job and returns immediately', async () => {
    mockPrisma.productImportJob.findFirst.mockResolvedValue({
      id: 'imp-1',
      shopId: 'shop-1',
      status: 'validated',
      storageKey: 'imports/shop-1/x.csv',
    });
    mockPrisma.productImportJob.update.mockResolvedValue({});

    const r = await service.confirmImport(merchant as never, 'imp-1');

    expect(r).toEqual(
      expect.objectContaining({
        importJobId: 'imp-1',
        status: 'queued',
        jobId: 'jq-1',
      }),
    );
    expect(mockQueues.enqueueImport).toHaveBeenCalledWith({
      importJobId: 'imp-1',
      shopId: 'shop-1',
      actorId: 'u1',
    });
    expect(mockPrisma.productImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'queued' },
      }),
    );
  });
});
