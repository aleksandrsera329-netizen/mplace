import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { StorageService } from '../storage/storage.service';
import { DomainEventService } from '../events/domain-event.service';
import { DomainEvents } from '../events/domain-events';
import { FileSecurityService } from '../common/upload/file-security.service';
import { QueueProducer } from '../queue/queue.producer';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

/** Loose product shape for search indexing fallback */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductSearchDocInline = any;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly search: SearchService,
    private readonly storage: StorageService,
    private readonly events: DomainEventService,
    private readonly queues: QueueProducer,
    private readonly fileSecurity: FileSecurityService,
  ) {}

  /** Stage 17: prefer async search-index queue; inline fallback without Redis */
  private async scheduleSearchIndex(
    productId: string,
    action: 'index' | 'remove',
    productForInline?: ProductSearchDocInline,
  ) {
    const enq = await this.queues.enqueueSearchIndex({ action, productId });
    if (enq.queued) return;
    if (action === 'remove') {
      await this.search.removeProduct(productId).catch(() => null);
      return;
    }
    if (productForInline) {
      await this.search.indexProduct(productForInline).catch(() => null);
    }
  }

  private async invalidateCatalogCache() {
    await this.cache.delByPattern('categories:*');
    await this.cache.delByPattern('products:*');
  }

  // ── Categories ─────────────────────────────────────────

  async listCategories() {
    const cacheKey = 'categories:all';
    const cached = await this.cache.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    await this.cache.set(cacheKey, categories, 600); // 10 min
    return categories;
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId || null,
      },
    });
    await this.invalidateCatalogCache();
    return category;
  }

  // ── Products ───────────────────────────────────────────

  /**
   * Cursor pagination: { items, nextCursor, hasMore }
   */
  async listProducts(user: JwtPayload | null, dto: ListProductsDto = {}) {
    const limit = dto.limit ?? 20;

    const isPublic =
      !user ||
      user.role === UserRole.CUSTOMER ||
      (user.role !== UserRole.MERCHANT &&
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.SUPER_ADMIN);

    // Cache first page of public catalog only (no cursor / search / category)
    const publicKey =
      isPublic &&
      !dto.cursor &&
      !dto.search &&
      !dto.categoryId &&
      !dto.status
        ? `products:public:active:l${limit}`
        : null;

    if (publicKey) {
      const cached = await this.cache.get<{
        items: unknown[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(publicKey);
      if (cached) return cached;
    }

    const where: Record<string, unknown> = {};

    if (user?.role === UserRole.MERCHANT) {
      if (!user.shopId) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      where.shopId = user.shopId;
    }

    if (dto.status && dto.status in ProductStatus) {
      where.status = dto.status as ProductStatus;
    } else if (isPublic) {
      where.status = ProductStatus.ACTIVE;
    }

    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }

    if (dto.search?.trim()) {
      const q = dto.search.trim();
      // SQLite/Postgres: contains; mode insensitive only on Postgres
      where.OR = [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { sku: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    // Public: only ACTIVE shops
    if (isPublic) {
      where.shop = { status: 'ACTIVE' };
    }

    const items = await this.prisma.product.findMany({
      where,
      take: limit,
      ...(dto.cursor
        ? {
            skip: 1,
            cursor: { id: dto.cursor },
          }
        : {}),
      orderBy: { id: 'asc' },
      include: {
        shop: {
          select: { id: true, name: true, slug: true, status: true },
        },
        category: { select: { id: true, name: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;
    const result = {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };

    if (publicKey) {
      await this.cache.set(publicKey, result, 300);
    }

    return result;
  }

  async getProduct(id: string, user: JwtPayload | null) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true } },
        stocks: {
          select: {
            id: true,
            warehouseId: true,
            quantity: true,
            reserved: true,
            warehouse: {
              select: { id: true, name: true, code: true, isDefault: true },
            },
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    this.assertCanRead(product.shopId, product.status, user);

    const availableFromStocks = product.stocks.length
      ? product.stocks.reduce(
          (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
          0,
        )
      : product.stock;

    return {
      ...product,
      /** Available to sell (quantity - reserved) */
      availableStock: availableFromStocks,
      stock: availableFromStocks,
    };
  }

  async createProduct(user: JwtPayload, dto: CreateProductDto) {
    const shopId = this.resolveShopIdForWrite(user, dto.shopId);
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    let status = dto.status ?? ProductStatus.DRAFT;
    // Pending/suspended shops cannot publish ACTIVE products
    if (
      status === ProductStatus.ACTIVE &&
      shop.status !== 'ACTIVE' &&
      user.role === UserRole.MERCHANT
    ) {
      status = ProductStatus.DRAFT;
    }

    const slug = dto.slug?.trim() || slugify(dto.name);
    const priceCents = this.resolvePriceCents(dto);
    if (priceCents < 0) {
      throw new ForbiddenException('Invalid price');
    }

    const product = await this.prisma.product.create({
      data: {
        shopId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        sku: dto.sku,
        gtin: dto.gtin,
        brand: dto.brand?.trim() || null,
        moq: dto.moq != null ? Math.max(1, dto.moq) : 1,
        attributes:
          dto.attributes != null
            ? (dto.attributes as Prisma.InputJsonValue)
            : undefined,
        priceCents,
        currency: dto.currency ?? 'USD',
        stock: Math.max(0, dto.stock ?? 0),
        categoryId: dto.categoryId || null,
        imageUrl: dto.imageUrl?.trim() || null,
        status,
      },
      include: {
        shop: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      meta: {
        name: product.name,
        priceCents: product.priceCents,
        shopId: product.shopId,
        status: product.status,
        imageUrl: product.imageUrl,
      },
    });
    await this.invalidateCatalogCache();
    if (product.status === ProductStatus.ACTIVE) {
      await this.scheduleSearchIndex(product.id, 'index', product);
    }

    this.events.emit(DomainEvents.ProductCreated, {
      productId: product.id,
      shopId: product.shopId,
      name: product.name,
      status: product.status,
    });

    return product;
  }

  async getProductStocks(user: JwtPayload, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    this.assertCanWriteShop(user, product.shopId);

    return this.prisma.productStock.findMany({
      where: { productId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            isDefault: true,
            city: true,
          },
        },
      },
      orderBy: { warehouse: { name: 'asc' } },
    });
  }

  async updateProduct(user: JwtPayload, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    this.assertCanWriteShop(user, existing.shopId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = dto.slug.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.gtin !== undefined) data.gtin = dto.gtin;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.price !== undefined || dto.priceCents !== undefined) {
      data.priceCents = this.resolvePriceCents(dto as CreateProductDto);
    }
    if (dto.imageUrl !== undefined) {
      const newUrl = dto.imageUrl?.trim() || null;
      data.imageUrl = newUrl;
      if (existing.imageUrl && existing.imageUrl !== newUrl) {
        await this.storage.deleteImage(existing.imageUrl);
      }
    }
    if (dto.brand !== undefined) data.brand = dto.brand?.trim() || null;
    if (dto.moq !== undefined) data.moq = Math.max(1, dto.moq);
    if (dto.attributes !== undefined) {
      data.attributes =
        dto.attributes == null
          ? Prisma.JsonNull
          : (dto.attributes as Prisma.InputJsonValue);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        shop: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: dto.status !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
      entityType: 'Product',
      entityId: product.id,
      meta: {
        changes: data,
        name: product.name,
        priceCents: product.priceCents,
      },
    });
    await this.invalidateCatalogCache();
    if (product.status === ProductStatus.ACTIVE) {
      await this.scheduleSearchIndex(product.id, 'index', product);
    } else {
      await this.scheduleSearchIndex(product.id, 'remove');
    }

    this.events.emit(DomainEvents.ProductUpdated, {
      productId: product.id,
      shopId: product.shopId,
      status: product.status,
    });

    return product;
  }

  async deleteProduct(user: JwtPayload, id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    this.assertCanWriteShop(user, existing.shopId);
    // Soft-delete: archive to preserve order history
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'DELETE',
      entityType: 'Product',
      entityId: id,
      meta: { soft: true, previousStatus: existing.status, name: existing.name },
    });
    await this.invalidateCatalogCache();
    await this.scheduleSearchIndex(id, 'remove');
    this.events.emit(DomainEvents.ProductDeleted, {
      productId: id,
      shopId: existing.shopId,
    });
    if (existing.imageUrl) {
      await this.storage.deleteImage(existing.imageUrl);
    }

    return { archived: true, id };
  }

  async uploadProductImage(file: Express.Multer.File) {
    const safe = await this.fileSecurity.assertSafe(file, 'image');
    this.fileSecurity.applySafeMeta(file, safe);
    const url = await this.storage.uploadImage(file, 'products');
    return { url };
  }

  // ── Product documents (certificates, datasheets, …) ────

  async addProductDocument(
    productId: string,
    user: JwtPayload,
    file: Express.Multer.File,
    name?: string,
    docType = 'certificate',
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    this.assertCanWriteShop(user, product.shopId);

    const safe = await this.fileSecurity.assertSafe(file, 'document');
    this.fileSecurity.applySafeMeta(file, safe);

    const isImage = safe.mimeType.startsWith('image/');
    const filePath = isImage
      ? await this.storage.uploadImage(file, 'documents')
      : await this.storage.uploadFile(file, 'documents');

    const doc = await this.prisma.productDocument.create({
      data: {
        productId,
        name: (name?.trim() || safe.safeOriginalName || 'document').slice(0, 200),
        filePath,
        docType: (docType || 'certificate').slice(0, 80),
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'CREATE',
      entityType: 'ProductDocument',
      entityId: doc.id,
      meta: { productId, name: doc.name, docType: doc.docType, filePath },
    });

    return doc;
  }

  async getProductDocuments(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productDocument.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteProductDocument(
    productId: string,
    docId: string,
    user: JwtPayload,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    this.assertCanWriteShop(user, product.shopId);

    const doc = await this.prisma.productDocument.findFirst({
      where: { id: docId, productId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.filePath) {
      await this.storage.deleteImage(doc.filePath);
    }
    await this.prisma.productDocument.delete({ where: { id: docId } });

    await this.audit.log({
      actorId: user.sub,
      action: 'DELETE',
      entityType: 'ProductDocument',
      entityId: docId,
      meta: { productId, name: doc.name, filePath: doc.filePath },
    });

    return { success: true };
  }

  /** Full reindex ACTIVE products into Meilisearch */
  async reindexAllProducts() {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: {
        category: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
      },
    });

    for (const product of products) {
      await this.search.indexProduct(product);
    }

    return {
      indexed: products.length,
      searchEnabled: this.search.enabled,
    };
  }

  /** Meilisearch product search (legacy path — delegates to Stage 17 advanced) */
  async searchProducts(
    query: string,
    opts?: {
      limit?: number;
      categoryId?: string;
      shopId?: string;
      brand?: string;
      priceMin?: number;
      priceMax?: number;
      inStock?: boolean | string;
      page?: number;
      sort?: string;
    },
  ) {
    return this.search.searchProductsAdvanced({
      q: query || '',
      limit: opts?.limit,
      categoryId: opts?.categoryId,
      shopId: opts?.shopId,
      brand: opts?.brand,
      priceMin: opts?.priceMin,
      priceMax: opts?.priceMax,
      inStock: opts?.inStock,
      page: opts?.page,
      sort: opts?.sort,
    });
  }

  // ── helpers ────────────────────────────────────────────

  private resolvePriceCents(dto: CreateProductDto): number {
    if (dto.priceCents !== undefined && dto.priceCents !== null) {
      return Math.round(dto.priceCents);
    }
    if (dto.price !== undefined && dto.price !== null) {
      return Math.round(Number(dto.price) * 100);
    }
    return 0;
  }

  private resolveShopIdForWrite(user: JwtPayload, bodyShopId?: string): string {
    if (user.role === UserRole.MERCHANT) {
      if (!user.shopId) {
        throw new ForbiddenException('Merchant has no shop');
      }
      return user.shopId;
    }
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      if (!bodyShopId) {
        throw new ForbiddenException('Admin must pass shopId');
      }
      return bodyShopId;
    }
    throw new ForbiddenException('Cannot create products');
  }

  private assertCanWriteShop(user: JwtPayload, shopId: string) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.MERCHANT && user.shopId === shopId) return;
    throw new ForbiddenException('Not your shop');
  }

  private assertCanRead(
    shopId: string,
    status: ProductStatus,
    user: JwtPayload | null,
  ) {
    if (status === ProductStatus.ACTIVE) return;
    if (!user) {
      throw new NotFoundException('Product not found');
    }
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.MERCHANT && user.shopId === shopId) return;
    throw new NotFoundException('Product not found');
  }
}
