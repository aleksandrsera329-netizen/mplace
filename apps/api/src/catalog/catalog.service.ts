import {
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
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
  ) {}

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
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    this.assertCanRead(product.shopId, product.status, user);
    return product;
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
      await this.search.indexProduct(product);
    }

    return product;
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
      await this.search.indexProduct(product);
    } else {
      await this.search.removeProduct(product.id);
    }

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
    await this.search.removeProduct(id);
    if (existing.imageUrl) {
      await this.storage.deleteImage(existing.imageUrl);
    }

    return { archived: true, id };
  }

  async uploadProductImage(file: Express.Multer.File) {
    const url = await this.storage.uploadImage(file, 'products');
    return { url };
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

  /** Meilisearch product search */
  async searchProducts(
    query: string,
    opts?: { limit?: number; categoryId?: string },
  ) {
    if (!query || query.trim().length < 2) {
      return { hits: [], query: query || '', estimatedTotalHits: 0 };
    }

    let filter = 'status = ACTIVE';
    if (opts?.categoryId) {
      // string id must be quoted for Meilisearch
      filter += ` AND categoryId = "${opts.categoryId}"`;
    }

    const result = await this.search.searchProducts(query.trim(), {
      limit: Math.min(Number(opts?.limit) || 20, 50),
      filter,
    });

    return result;
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
