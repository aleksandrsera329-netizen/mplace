import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { FileSecurityService } from '../common/upload/file-security.service';
import { QueueProducer } from '../queue/queue.producer';
import { SearchService } from '../search/search.service';
import { CreateProductDto } from '../catalog/dto/create-product.dto';
import { UpdateProductDto } from '../catalog/dto/update-product.dto';
import { Prisma } from '@prisma/client';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export type ImportRowError = {
  row: number;
  field: string;
  message: string;
};

export type ParsedImportRow = {
  row: number;
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  categoryId?: string;
  priceCents: number;
  currency: string;
  stock: number;
  moq?: number;
  weight?: string;
  vat?: string;
  imageUrl?: string;
  valid: boolean;
};

@Injectable()
export class MerchantProductsService {
  private readonly logger = new Logger(MerchantProductsService.name);
  private readonly importRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly search: SearchService,
    private readonly queues: QueueProducer,
    private readonly fileSecurity: FileSecurityService,
  ) {
    this.importRoot = join(process.cwd(), 'uploads', 'imports');
  }

  private shopId(user: JwtPayload): string {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException('Merchant shop required');
    }
    return user.shopId;
  }

  private async assertOwnProduct(shopId: string, productId: string) {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private resolvePriceCents(dto: {
    price?: number;
    priceCents?: number;
  }): number {
    if (dto.priceCents != null) return Math.round(dto.priceCents);
    if (dto.price != null) return Math.round(dto.price * 100);
    return 0;
  }

  /** Stage 17: async index via search-index queue */
  private async scheduleSearchIndex(
    productId: string,
    action: 'index' | 'remove',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    productForInline?: any,
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

  async list(
    user: JwtPayload,
    query: {
      status?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    } = {},
  ) {
    const shopId = this.shopId(user);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const where: Record<string, unknown> = { shopId };

    if (query.status && query.status in ProductStatus) {
      where.status = query.status as ProductStatus;
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const items = await this.prisma.product.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { images: true } },
      },
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
      hasMore,
    };
  }

  async getOne(user: JwtPayload, id: string) {
    const shopId = this.shopId(user);
    const product = await this.prisma.product.findFirst({
      where: { id, shopId },
      include: {
        category: { select: { id: true, name: true } },
        images: true,
        stocks: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(user: JwtPayload, dto: CreateProductDto) {
    const shopId = this.shopId(user);
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    let status = dto.status ?? ProductStatus.DRAFT;
    if (status === ProductStatus.ACTIVE && shop.status !== 'ACTIVE') {
      status = ProductStatus.DRAFT;
    }

    let slug = dto.slug?.trim() || slugify(dto.name);
    slug = await this.uniqueSlug(shopId, slug);

    const priceCents = this.resolvePriceCents(dto);
    if (priceCents < 0) throw new BadRequestException('Invalid price');

    if (dto.sku) {
      const dup = await this.prisma.product.findFirst({
        where: { shopId, sku: dto.sku.trim() },
      });
      if (dup) throw new BadRequestException(`SKU already exists: ${dto.sku}`);
    }

    const product = await this.prisma.product.create({
      data: {
        shopId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        sku: dto.sku?.trim() || null,
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
        category: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      meta: { shopId, name: product.name, source: 'merchant' },
    });
    if (product.status === ProductStatus.ACTIVE) {
      await this.scheduleSearchIndex(product.id, 'index', product);
    }
    return product;
  }

  async update(user: JwtPayload, id: string, dto: UpdateProductDto) {
    const shopId = this.shopId(user);
    const existing = await this.assertOwnProduct(shopId, id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueSlug(shopId, dto.slug.trim(), id);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sku !== undefined) {
      const sku = dto.sku?.trim() || null;
      if (sku) {
        const dup = await this.prisma.product.findFirst({
          where: { shopId, sku, NOT: { id } },
        });
        if (dup) throw new BadRequestException(`SKU already exists: ${sku}`);
      }
      data.sku = sku;
    }
    if (dto.gtin !== undefined) data.gtin = dto.gtin;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.stock !== undefined) data.stock = Math.max(0, dto.stock);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl?.trim() || null;
    if (dto.price !== undefined || dto.priceCents !== undefined) {
      data.priceCents = this.resolvePriceCents(dto);
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
        category: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      meta: { changes: data, shopId },
    });

    if (product.status === ProductStatus.ACTIVE) {
      await this.scheduleSearchIndex(product.id, 'index', product);
    } else {
      await this.scheduleSearchIndex(id, 'remove');
    }
    return product;
  }

  async duplicate(user: JwtPayload, id: string) {
    const shopId = this.shopId(user);
    const src = await this.assertOwnProduct(shopId, id);
    const slug = await this.uniqueSlug(shopId, `${src.slug}-copy`);
    const sku = src.sku ? `${src.sku}-COPY-${randomUUID().slice(0, 4)}` : null;

    const product = await this.prisma.product.create({
      data: {
        shopId,
        name: `${src.name} (copy)`,
        slug,
        description: src.description,
        sku,
        gtin: src.gtin,
        priceCents: src.priceCents,
        currency: src.currency,
        stock: src.stock,
        categoryId: src.categoryId,
        imageUrl: src.imageUrl,
        status: ProductStatus.DRAFT,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      meta: { duplicatedFrom: id, shopId },
    });
    return product;
  }

  async archive(user: JwtPayload, id: string) {
    const shopId = this.shopId(user);
    await this.assertOwnProduct(shopId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });
    await this.scheduleSearchIndex(id, 'remove');
    await this.audit.log({
      actorId: user.sub,
      action: 'STATUS_CHANGE',
      entityType: 'Product',
      entityId: id,
      meta: { status: 'ARCHIVED', shopId },
    });
    return product;
  }

  async remove(user: JwtPayload, id: string) {
    // Soft delete = archive
    return this.archive(user, id);
  }

  async bulkUpdate(
    user: JwtPayload,
    ids: string[],
    data: {
      status?: ProductStatus;
      categoryId?: string | null;
      priceCents?: number;
      stock?: number;
    },
  ) {
    const shopId = this.shopId(user);
    if (!ids?.length) throw new BadRequestException('ids required');
    if (ids.length > 200) throw new BadRequestException('Max 200 ids');

    const owned = await this.prisma.product.findMany({
      where: { shopId, id: { in: ids } },
      select: { id: true },
    });
    const ownedIds = owned.map((p) => p.id);
    if (!ownedIds.length) {
      return { updated: 0, ids: [] };
    }

    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
    if (data.priceCents !== undefined) {
      if (data.priceCents < 0) throw new BadRequestException('Invalid price');
      patch.priceCents = data.priceCents;
    }
    if (data.stock !== undefined) patch.stock = Math.max(0, data.stock);

    if (!Object.keys(patch).length) {
      throw new BadRequestException('No fields to update');
    }

    const result = await this.prisma.product.updateMany({
      where: { shopId, id: { in: ownedIds } },
      data: patch,
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: ownedIds[0],
      meta: { bulk: true, ids: ownedIds, patch, shopId },
    });

    // Reindex / remove from search (best-effort via queue)
    if (data.status === ProductStatus.ARCHIVED) {
      for (const pid of ownedIds) {
        await this.scheduleSearchIndex(pid, 'remove');
      }
    } else if (
      data.status === ProductStatus.ACTIVE ||
      data.priceCents !== undefined ||
      data.stock !== undefined ||
      data.categoryId !== undefined
    ) {
      for (const pid of ownedIds) {
        await this.scheduleSearchIndex(pid, 'index');
      }
    }

    return { updated: result.count, ids: ownedIds };
  }

  // ── Import pipeline ────────────────────────────────────

  async uploadImport(
    user: JwtPayload,
    file: Express.Multer.File,
  ) {
    const shopId = this.shopId(user);
    // Stage 24: CSV only — size/ext/text magic + optional ClamAV
    const safe = await this.fileSecurity.assertSafe(file, 'csv');
    this.fileSecurity.applySafeMeta(file, safe);

    await mkdir(this.importRoot, { recursive: true });
    // Never use original filename in storage path
    const storageKey = `imports/${shopId}/${safe.storageKeyName.endsWith('.csv') || safe.storageKeyName.endsWith('.txt') ? safe.storageKeyName : `${randomUUID()}.csv`}`;
    const fullPath = join(process.cwd(), 'uploads', storageKey);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, safe.buffer);

    const job = await this.prisma.productImportJob.create({
      data: {
        shopId,
        fileName: safe.safeOriginalName,
        storageKey,
        status: 'uploaded',
      },
    });

    // Auto-validate for convenience
    return this.previewImport(user, job.id);
  }

  async previewImport(user: JwtPayload, jobId: string) {
    const shopId = this.shopId(user);
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, shopId },
    });
    if (!job) throw new NotFoundException('Import job not found');

    const fullPath = join(process.cwd(), 'uploads', job.storageKey);
    let text: string;
    try {
      text = await readFile(fullPath, 'utf8');
    } catch {
      throw new BadRequestException('Import file missing on disk');
    }

    const { rows, errors } = await this.parseAndValidateCsv(shopId, text);
    const valid = rows.filter((r) => r.valid);
    const preview = rows.slice(0, 20);

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: {
        status: 'validated',
        totalRows: rows.length,
        validRows: valid.length,
        errorRows: errors.length,
        errors: errors as object[],
        preview: preview as object[],
      },
    });

    return {
      importJobId: jobId,
      total: rows.length,
      valid: valid.length,
      errors,
      preview,
      status: 'validated',
    };
  }

  /**
   * Stage 19: HTTP returns immediately with jobId; heavy work runs in imports queue.
   * Without Redis falls back to inline processImportJob.
   */
  async confirmImport(user: JwtPayload, jobId: string) {
    const shopId = this.shopId(user);
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, shopId },
    });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.status === 'completed') {
      return { importJobId: jobId, status: 'completed', created: 0 };
    }
    if (job.status === 'processing') {
      return {
        importJobId: jobId,
        status: 'processing',
        message: 'Import already running',
      };
    }
    if (job.status !== 'validated' && job.status !== 'uploaded') {
      throw new BadRequestException(
        `Import job cannot be confirmed from status=${job.status}`,
      );
    }

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: { status: 'queued' },
    });

    const queued = await this.queues.enqueueImport({
      importJobId: jobId,
      shopId,
      actorId: user.sub,
    });

    if (!queued.queued) {
      // Dev without Redis: process inline so API still works
      this.logger.warn(
        `Import queue offline — processing import ${jobId} inline`,
      );
      return this.processImportJob(jobId, user.sub);
    }

    return {
      importJobId: jobId,
      jobId: queued.jobId,
      status: 'queued',
      message: 'Import accepted; processing in background',
    };
  }

  /**
   * Worker entry: create products from a validated/queued ProductImportJob.
   */
  async processImportJob(jobId: string, actorId?: string) {
    const job = await this.prisma.productImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.status === 'completed') {
      return { importJobId: jobId, status: 'completed' as const, created: 0 };
    }

    const shopId = job.shopId;
    const fullPath = join(process.cwd(), 'uploads', job.storageKey);
    let text: string;
    try {
      text = await readFile(fullPath, 'utf8');
    } catch {
      await this.prisma.productImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [
            { row: 0, field: 'file', message: 'Import file missing on disk' },
          ] as object[],
        },
      });
      throw new BadRequestException('Import file missing on disk');
    }

    const { rows, errors } = await this.parseAndValidateCsv(shopId, text);
    const valid = rows.filter((r) => r.valid);

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    let created = 0;
    const createdIds: string[] = [];

    for (const row of valid) {
      try {
        let categoryId = row.categoryId || null;
        if (!categoryId && row.category) {
          const cat = await this.prisma.category.findFirst({
            where: {
              OR: [
                { name: { equals: row.category, mode: 'insensitive' } },
                { slug: slugify(row.category) },
              ],
            },
          });
          categoryId = cat?.id || null;
        }

        const slug = await this.uniqueSlug(
          shopId,
          slugify(row.name || row.sku || `import-${row.row}`),
        );

        const product = await this.prisma.product.create({
          data: {
            shopId,
            name: row.name,
            slug,
            description: row.description || null,
            sku: row.sku || null,
            priceCents: row.priceCents,
            currency: row.currency || 'USD',
            stock: row.stock,
            categoryId,
            imageUrl: row.imageUrl || null,
            status: ProductStatus.ACTIVE,
          },
        });
        createdIds.push(product.id);
        created++;
        if (product.status === ProductStatus.ACTIVE) {
          // Prefer async search reindex when queue available
          const enq = await this.queues.enqueueSearchIndex({
            action: 'index',
            productId: product.id,
          });
          if (!enq.queued) {
            await this.search.indexProduct(product).catch(() => null);
          }
        }
      } catch (e) {
        this.logger.warn(
          `Import row ${row.row} failed: ${e instanceof Error ? e.message : e}`,
        );
        errors.push({
          row: row.row,
          field: '_create',
          message: e instanceof Error ? e.message : 'create failed',
        });
      }
    }

    await this.prisma.productImportJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalRows: rows.length,
        validRows: valid.length,
        errorRows: errors.length,
        errors: errors as object[],
      },
    });

    await this.audit.log({
      actorId: actorId || null,
      action: 'CREATE',
      entityType: 'ProductImportJob',
      entityId: jobId,
      meta: { shopId, created, total: rows.length },
    });

    return {
      importJobId: jobId,
      status: 'completed' as const,
      created,
      skipped: rows.length - created,
      errors,
      productIds: createdIds,
    };
  }

  async getImportJob(user: JwtPayload, jobId: string) {
    const shopId = this.shopId(user);
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, shopId },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  private async uniqueSlug(
    shopId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = base || `product-${randomUUID().slice(0, 8)}`;
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? slug : `${slug}-${i}`;
      const exists = await this.prisma.product.findFirst({
        where: {
          shopId,
          slug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return `${slug}-${randomUUID().slice(0, 6)}`;
  }

  private async parseAndValidateCsv(
    shopId: string,
    text: string,
  ): Promise<{ rows: ParsedImportRow[]; errors: ImportRowError[] }> {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return {
        rows: [],
        errors: [{ row: 0, field: 'file', message: 'CSV has no data rows' }],
      };
    }

    const headers = this.splitCsvLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, ''),
    );
    const idx = (names: string[]) => {
      for (const n of names) {
        const i = headers.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };

    const iSku = idx(['sku', 'артикул']);
    const iName = idx(['name', 'title', 'название', 'наименование']);
    const iDesc = idx(['description', 'desc', 'описание']);
    const iCat = idx(['category', 'categoryname', 'категория']);
    const iCatId = idx(['categoryid']);
    const iPrice = idx(['price', 'pricecents', 'цена']);
    const iCur = idx(['currency', 'валюта']);
    const iStock = idx(['stock', 'qty', 'quantity', 'остаток']);
    const iMoq = idx(['moq']);
    const iWeight = idx(['weight', 'вес']);
    const iVat = idx(['vat', 'nds', 'ндс']);
    const iImg = idx(['image', 'imageurl', 'images', 'фото']);

    if (iName < 0 && iSku < 0) {
      return {
        rows: [],
        errors: [
          {
            row: 1,
            field: 'header',
            message: 'CSV must have name or sku column',
          },
        ],
      };
    }

    const existingSkus = new Set(
      (
        await this.prisma.product.findMany({
          where: { shopId, sku: { not: null } },
          select: { sku: true },
        })
      )
        .map((p) => p.sku)
        .filter(Boolean) as string[],
    );
    const fileSkus = new Set<string>();

    const rows: ParsedImportRow[] = [];
    const errors: ImportRowError[] = [];

    for (let li = 1; li < lines.length; li++) {
      const cols = this.splitCsvLine(lines[li]);
      const rowNum = li + 1;
      const get = (i: number) => (i >= 0 ? (cols[i] || '').trim() : '');

      const sku = get(iSku) || undefined;
      const name = get(iName) || sku || '';
      const desc = get(iDesc) || undefined;
      const category = get(iCat) || undefined;
      const categoryId = get(iCatId) || undefined;
      const priceRaw = get(iPrice);
      const currency = (get(iCur) || 'USD').toUpperCase();
      const stockRaw = get(iStock) || '0';
      const moqRaw = get(iMoq);
      const weight = get(iWeight) || undefined;
      const vat = get(iVat) || undefined;
      const imageUrl = get(iImg)?.split(/[;,]/)[0]?.trim() || undefined;

      let valid = true;
      let priceCents = 0;

      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'required' });
        valid = false;
      }

      if (priceRaw) {
        const n = Number(priceRaw.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) {
          errors.push({
            row: rowNum,
            field: 'price',
            message: 'must be positive number',
          });
          valid = false;
        } else if (
          headers[iPrice] === 'pricecents' ||
          (Number.isInteger(n) && n >= 100 && !priceRaw.includes('.'))
        ) {
          // heuristic: large integers without decimal = cents; prefer major units if has .
          priceCents =
            priceRaw.includes('.') || priceRaw.includes(',')
              ? Math.round(n * 100)
              : headers[iPrice] === 'pricecents'
                ? Math.round(n)
                : Math.round(n * 100);
        } else {
          priceCents = Math.round(n * 100);
        }
      } else {
        errors.push({ row: rowNum, field: 'price', message: 'required' });
        valid = false;
      }

      if (priceCents < 0) {
        errors.push({
          row: rowNum,
          field: 'price',
          message: 'must be positive',
        });
        valid = false;
      }

      const stock = Math.max(0, parseInt(stockRaw, 10) || 0);
      if (stockRaw && Number.isNaN(parseInt(stockRaw, 10))) {
        errors.push({
          row: rowNum,
          field: 'stock',
          message: 'must be integer',
        });
        valid = false;
      }

      if (sku) {
        if (existingSkus.has(sku) || fileSkus.has(sku)) {
          errors.push({
            row: rowNum,
            field: 'sku',
            message: 'duplicate SKU',
          });
          valid = false;
        } else {
          fileSkus.add(sku);
        }
      }

      const moq = moqRaw ? parseInt(moqRaw, 10) : undefined;

      rows.push({
        row: rowNum,
        sku,
        name,
        description: [desc, moq ? `MOQ: ${moq}` : '', weight ? `Weight: ${weight}` : '', vat ? `VAT: ${vat}` : '']
          .filter(Boolean)
          .join('\n') || undefined,
        category,
        categoryId,
        priceCents,
        currency,
        stock,
        moq,
        weight,
        vat,
        imageUrl,
        valid,
      });
    }

    return { rows, errors };
  }

  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((c === ',' || c === ';') && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }
}
