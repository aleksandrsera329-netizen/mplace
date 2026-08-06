import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CacheService } from '../cache/cache.service';
import { SearchService } from '../search/search.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

// Avoid loading meilisearch ESM in unit tests
jest.mock('meilisearch', () => ({
  Meilisearch: jest.fn().mockImplementation(() => ({
    index: jest.fn(),
    getIndex: jest.fn(),
  })),
}));

describe('CatalogService', () => {
  let service: CatalogService;

  const mockPrisma = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    productDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delByPattern: jest.fn(),
  };

  const mockSearch = {
    indexProduct: jest.fn(),
    removeProduct: jest.fn(),
    searchProducts: jest.fn(),
    enabled: true,
  };

  const mockStorage = {
    uploadImage: jest.fn(),
    uploadFile: jest.fn(),
    deleteImage: jest.fn(),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: SearchService, useValue: mockSearch },
        { provide: StorageService, useValue: mockStorage },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    jest.clearAllMocks();
    mockAudit.log.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listProducts', () => {
    it('should return products with pagination', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Pump', priceCents: 10000, status: 'ACTIVE' },
        { id: 'p2', name: 'Valve', priceCents: 5000, status: 'ACTIVE' },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockCache.get.mockResolvedValue(null);

      const result = await service.listProducts(null, { limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('hasMore');
      // limit 20, 2 items → no next page
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should use cache for public first page', async () => {
      const cached = { items: [], nextCursor: null, hasMore: false };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.listProducts(null, { limit: 20 });

      expect(result).toEqual(cached);
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should filter by merchant shopId', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Mine', shopId: 'shop-1' },
      ]);

      const merchant: JwtPayload = {
        sub: 'user-1',
        email: 'm@demo.com',
        role: UserRole.MERCHANT,
        shopId: 'shop-1',
      };

      const result = await service.listProducts(merchant, { limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shopId: 'shop-1' }),
        }),
      );
    });
  });

  describe('createProduct', () => {
    const merchantUser: JwtPayload = {
      sub: 'user-1',
      email: 'merchant@demo.com',
      role: UserRole.MERCHANT,
      shopId: 'shop-1',
    };

    const createDto = {
      name: 'Test Pump',
      priceCents: 150000,
      stock: 10,
      status: ProductStatus.DRAFT,
    };

    it('should create product for merchant', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        id: 'shop-1',
        status: 'ACTIVE',
      });
      mockPrisma.product.create.mockResolvedValue({
        id: 'new-product',
        ...createDto,
        shopId: 'shop-1',
        priceCents: 150000,
        status: ProductStatus.DRAFT,
      });

      const result = await service.createProduct(merchantUser, createDto as any);

      expect(result.name).toBe('Test Pump');
      expect(mockPrisma.product.create).toHaveBeenCalled();
      expect(mockCache.delByPattern).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entityType: 'Product' }),
      );
      // DRAFT → no meilisearch index
      expect(mockSearch.indexProduct).not.toHaveBeenCalled();
    });

    it('should throw if shop not found', async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      await expect(
        service.createProduct(merchantUser, createDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProduct', () => {
    it('should update product', async () => {
      const existing = {
        id: 'p1',
        name: 'Old Name',
        shopId: 'shop-1',
        status: ProductStatus.ACTIVE,
        imageUrl: null,
      };

      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue({
        ...existing,
        name: 'New Name',
        status: ProductStatus.ACTIVE,
        priceCents: 1000,
      });

      const user: JwtPayload = {
        sub: 'user-1',
        email: 'm@demo.com',
        role: UserRole.MERCHANT,
        shopId: 'shop-1',
      };

      const result = await service.updateProduct(user, 'p1', {
        name: 'New Name',
      } as any);

      expect(result.name).toBe('New Name');
      expect(mockSearch.indexProduct).toHaveBeenCalled();
      expect(mockCache.delByPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProduct(
          {
            sub: 'u1',
            email: 'a@a.com',
            role: UserRole.ADMIN,
            shopId: null,
          },
          'missing',
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchProducts', () => {
    it('should search via Meilisearch', async () => {
      mockSearch.searchProducts.mockResolvedValue({
        hits: [{ id: 'p1', name: 'Pump' }],
        estimatedTotalHits: 1,
      });

      const result = await service.searchProducts('pump', { limit: 10 });

      expect(result.hits).toHaveLength(1);
      expect(mockSearch.searchProducts).toHaveBeenCalledWith(
        'pump',
        expect.objectContaining({ limit: 10 }),
      );
    });

    it('should return empty for short query', async () => {
      const result = await service.searchProducts('a');
      expect(result.hits).toEqual([]);
      expect(mockSearch.searchProducts).not.toHaveBeenCalled();
    });
  });
});
