import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TaxLineInput = {
  productId: string;
  quantity: number;
  priceCents: number;
};

export type TaxLineResult = {
  productId: string;
  quantity: number;
  priceCents: number;
  subtotalCents: number;
  taxRateId: string | null;
  taxRate: number;
  taxName: string | null;
  taxCents: number;
  totalCents: number;
};

export type TaxCalculation = {
  items: TaxLineResult[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async createRate(
    tenantId: string | null,
    data: {
      name: string;
      code?: string;
      rate: number;
      country: string;
      isDefault?: boolean;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('name обязателен');
    }
    if (data.rate < 0 || data.rate > 1) {
      throw new BadRequestException('rate: число от 0 до 1 (0.20 = 20%)');
    }
    const country = (data.country || 'RU').trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({
          where: {
            country,
            isDefault: true,
            ...(tenantId ? { tenantId } : { tenantId: null }),
          },
          data: { isDefault: false },
        });
      }

      return tx.taxRate.create({
        data: {
          tenantId,
          name: data.name.trim(),
          code: data.code?.trim() || null,
          rate: new Prisma.Decimal(data.rate),
          country,
          isDefault: data.isDefault ?? false,
          isActive: true,
        },
      });
    });
  }

  async listRates(tenantId: string | null) {
    return this.prisma.taxRate.findMany({
      where: {
        isActive: true,
        ...(tenantId
          ? { OR: [{ tenantId }, { tenantId: null }] }
          : {}),
      },
      orderBy: [{ country: 'asc' }, { rate: 'desc' }],
    });
  }

  /**
   * Calculate tax per line: product-specific TaxRate, else default for country.
   */
  async calculate(
    tenantId: string | null,
    items: TaxLineInput[],
    country = 'RU',
  ): Promise<TaxCalculation> {
    const countryNorm = (country || 'RU').trim().toUpperCase();

    const defaultTax = await this.prisma.taxRate.findFirst({
      where: {
        country: countryNorm,
        isDefault: true,
        isActive: true,
        ...(tenantId
          ? { OR: [{ tenantId }, { tenantId: null }] }
          : { tenantId: null }),
      },
      orderBy: { tenantId: 'desc' }, // prefer tenant-specific over platform
    });

    // Fallback: any default for country without tenant filter
    const fallbackDefault =
      defaultTax ||
      (await this.prisma.taxRate.findFirst({
        where: {
          country: countryNorm,
          isDefault: true,
          isActive: true,
        },
      }));

    const result: TaxLineResult[] = [];

    for (const item of items) {
      const productTax = await this.prisma.productTax.findFirst({
        where: { productId: item.productId },
        include: { taxRate: true },
        orderBy: { createdAt: 'asc' },
      });

      const taxRateRow =
        productTax?.taxRate?.isActive !== false
          ? productTax?.taxRate
          : null;
      const taxRate = taxRateRow || fallbackDefault;
      const rate = taxRate ? Number(taxRate.rate) : 0;
      const subtotal = Math.max(0, item.priceCents) * Math.max(0, item.quantity);
      const taxCents = Math.round(subtotal * rate);

      result.push({
        productId: item.productId,
        quantity: item.quantity,
        priceCents: item.priceCents,
        subtotalCents: subtotal,
        taxRateId: taxRate?.id || null,
        taxRate: rate,
        taxName: taxRate?.name || null,
        taxCents,
        totalCents: subtotal + taxCents,
      });
    }

    const subtotalCents = result.reduce((s, i) => s + i.subtotalCents, 0);
    const taxCents = result.reduce((s, i) => s + i.taxCents, 0);

    return {
      items: result,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
    };
  }
}
