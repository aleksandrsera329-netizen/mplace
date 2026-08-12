import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PdfService } from './pdf.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Next document number: СЧ-2026-00047
   */
  async generateNumber(
    tenantId: string | null,
    type: DocumentType,
  ): Promise<string> {
    const prefixMap: Record<DocumentType, string> = {
      INVOICE: 'СЧ',
      ACT: 'АКТ',
      UPD: 'УПД',
      OFFER: 'КП',
    };

    const year = new Date().getFullYear();
    // ASCII-safe for file names too: INV-2026-00001 if Cyrillic issues
    const prefix = `${prefixMap[type]}-${year}-`;

    const lastDoc = await this.prisma.document.findFirst({
      where: {
        type,
        ...(tenantId ? { tenantId } : {}),
        number: { startsWith: prefix },
      },
      orderBy: { number: 'desc' },
    });

    let nextNum = 1;
    if (lastDoc) {
      const lastNumber = parseInt(lastDoc.number.replace(prefix, ''), 10);
      if (!Number.isNaN(lastNumber)) nextNum = lastNumber + 1;
    }

    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  async createInvoiceFromOrder(
    orderId: string,
    tenantId: string | null,
    user?: JwtPayload,
  ) {
    return this.createFromOrder(orderId, tenantId, DocumentType.INVOICE, user);
  }

  async createActFromOrder(
    orderId: string,
    tenantId: string | null,
    user?: JwtPayload,
  ) {
    return this.createFromOrder(orderId, tenantId, DocumentType.ACT, user);
  }

  private async createFromOrder(
    orderId: string,
    tenantId: string | null,
    type: DocumentType,
    user?: JwtPayload,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: {
          select: { id: true, name: true, email: true, company: true },
        },
        shop: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    this.assertCanAccessOrder(order, user);

    const resolvedTenant =
      tenantId || order.tenantId || user?.tenantId || null;

    const number = await this.generateNumber(resolvedTenant, type);

    const data: Prisma.InputJsonValue = {
      orderNumber: order.orderNumber,
      buyer: {
        name:
          order.customerName ||
          order.customer?.company ||
          order.customer?.name ||
          order.customerEmail ||
          order.customer?.email ||
          '—',
        email: order.customerEmail || order.customer?.email || null,
      },
      seller: {
        name: order.shop?.name || '—',
      },
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        priceCents: item.unitPriceCents,
        taxCents: item.taxCents || 0,
        totalCents:
          item.lineTotalCents + (item.taxCents || 0),
      })),
      shippingPriceCents: order.shippingPriceCents || 0,
      taxCents: order.taxCents || 0,
    };

    let document = await this.prisma.document.create({
      data: {
        tenantId: resolvedTenant,
        orderId: order.id,
        type,
        number,
        status: DocumentStatus.ISSUED,
        subtotalCents: order.subtotalCents || 0,
        taxCents: order.taxCents || 0,
        totalCents: order.totalCents || 0,
        currency: order.currency || 'RUB',
        data,
      },
    });

    // Generate & store PDF
    try {
      const buffer =
        type === DocumentType.ACT
          ? await this.pdf.generateAct(document)
          : await this.pdf.generateInvoice(document);

      const safeName = number.replace(/[^\w.-]+/g, '_');
      const pdfUrl = await this.storage.uploadFile(
        {
          buffer,
          originalname: `${safeName}.pdf`,
          mimetype: 'application/pdf',
          size: buffer.length,
        } as Express.Multer.File,
        'documents',
      );

      document = await this.prisma.document.update({
        where: { id: document.id },
        data: { pdfUrl },
      });
    } catch (e) {
      this.logger.warn(
        `PDF generation failed for ${number}: ${e instanceof Error ? e.message : e}`,
      );
    }

    return document;
  }

  async list(params: {
    tenantId?: string | null;
    orderId?: string;
    user?: JwtPayload;
  }) {
    const where: Prisma.DocumentWhereInput = {};
    if (params.orderId) where.orderId = params.orderId;
    if (params.tenantId) where.tenantId = params.tenantId;

    // Merchants see docs for their shop orders
    if (params.user?.role === 'MERCHANT' && params.user.shopId) {
      where.order = { shopId: params.user.shopId };
    } else if (params.user?.role === 'CUSTOMER') {
      where.order = { customerId: params.user.sub };
    }

    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true },
        },
      },
    });
  }

  async getOne(id: string, user?: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            shopId: true,
            customerId: true,
            tenantId: true,
          },
        },
      },
    });
    if (!document) throw new NotFoundException('Документ не найден');
    if (document.order) {
      this.assertCanAccessOrder(document.order, user);
    }
    return document;
  }

  async getPdfBuffer(id: string, user?: JwtPayload): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const document = await this.getOne(id, user);
    const buffer =
      document.type === DocumentType.ACT
        ? await this.pdf.generateAct(document)
        : await this.pdf.generateInvoice(document);
    const filename = `${document.number.replace(/[^\w.-]+/g, '_')}.pdf`;
    return { buffer, filename };
  }

  private assertCanAccessOrder(
    order: {
      shopId?: string;
      customerId?: string | null;
      tenantId?: string | null;
    },
    user?: JwtPayload,
  ) {
    if (!user) return;
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return;
    if (user.role === 'MERCHANT' && user.shopId === order.shopId) return;
    if (user.role === 'CUSTOMER' && user.sub === order.customerId) return;
    throw new ForbiddenException('Нет доступа к заказу/документу');
  }
}
