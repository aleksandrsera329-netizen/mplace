import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
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
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ─────────────────────────────────────────

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId || null,
      },
    });
  }

  // ── Products ───────────────────────────────────────────

  async listProducts(user: JwtPayload | null, opts?: { status?: string }) {
    const where: {
      shopId?: string;
      status?: ProductStatus;
    } = {};

    if (user?.role === UserRole.MERCHANT) {
      if (!user.shopId) {
        return [];
      }
      where.shopId = user.shopId;
    }

    if (opts?.status && opts.status in ProductStatus) {
      where.status = opts.status as ProductStatus;
    } else if (!user || user.role === UserRole.CUSTOMER) {
      where.status = ProductStatus.ACTIVE;
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        shop: {
          select: { id: true, name: true, slug: true, status: true },
        },
        category: { select: { id: true, name: true } },
      },
    });

    // Public catalog: only ACTIVE shops
    if (!user || user.role === UserRole.CUSTOMER) {
      return products.filter((p) => p.shop.status === 'ACTIVE');
    }
    return products;
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

    return this.prisma.product.create({
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
        status,
      },
      include: {
        shop: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
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

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        shop: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
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
    return { archived: true, id };
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
