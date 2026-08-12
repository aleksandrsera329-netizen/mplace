import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculateShippingCommand } from './calculate-shipping.command';

@Injectable()
@CommandHandler(CalculateShippingCommand)
export class CalculateShippingHandler
  implements ICommandHandler<CalculateShippingCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CalculateShippingCommand) {
    const { country, region, weightKg, warehouseId, merchantId } = cmd.data;
    if (!country?.trim()) {
      throw new BadRequestException('country обязателен');
    }
    const weight = Number(weightKg) || 0;
    const countryNorm = country.trim().toUpperCase();

    // Zones matching country (and optionally region)
    const zoneWhere: Prisma.ShippingZoneWhereInput = {
      countries: { has: countryNorm },
    };
    if (cmd.tenantId) {
      zoneWhere.OR = [{ tenantId: cmd.tenantId }, { tenantId: null }];
    }
    if (region?.trim()) {
      // Prefer zones that include region; also allow empty regions = whole country
      zoneWhere.AND = [
        {
          OR: [
            { regions: { isEmpty: true } },
            { regions: { has: region.trim() } },
          ],
        },
      ];
    }

    const zones = await this.prisma.shippingZone.findMany({ where: zoneWhere });
    if (zones.length === 0) {
      // Fallback: any zone for this country without region filter
      const fallback = await this.prisma.shippingZone.findMany({
        where: {
          countries: { has: countryNorm },
          ...(cmd.tenantId
            ? { OR: [{ tenantId: cmd.tenantId }, { tenantId: null }] }
            : {}),
        },
      });
      if (fallback.length === 0) return [];
      return this.ratesForZones(
        fallback.map((z) => z.id),
        weight,
        warehouseId,
        merchantId,
        cmd.tenantId,
      );
    }

    return this.ratesForZones(
      zones.map((z) => z.id),
      weight,
      warehouseId,
      merchantId,
      cmd.tenantId,
    );
  }

  private async ratesForZones(
    zoneIds: string[],
    weightKg: number,
    warehouseId: string | undefined,
    merchantId: string | undefined,
    tenantId: string | null,
  ) {
    const methodFilter: Prisma.ShippingMethodWhereInput = {
      isActive: true,
    };
    if (tenantId) {
      methodFilter.OR = [{ tenantId }, { tenantId: null }];
    }
    if (merchantId) {
      methodFilter.AND = [
        {
          OR: [{ merchantId }, { merchantId: null }],
        },
      ];
    }

    const rates = await this.prisma.shippingRate.findMany({
      where: {
        isActive: true,
        shippingZoneId: { in: zoneIds },
        ...(warehouseId
          ? { OR: [{ warehouseId }, { warehouseId: null }] }
          : {}),
        method: methodFilter,
        AND: [
          {
            OR: [
              { minWeightKg: null },
              { minWeightKg: { lte: weightKg } },
            ],
          },
          {
            OR: [
              { maxWeightKg: null },
              { maxWeightKg: { gte: weightKg } },
            ],
          },
        ],
      },
      include: {
        method: true,
        zone: true,
        warehouse: true,
      },
      orderBy: { priceCents: 'asc' },
    });

    return rates.map((rate) => {
      let total = rate.priceCents;
      if (rate.pricePerKgCents && weightKg > 0) {
        const billable = Math.max(
          0,
          Math.ceil(weightKg) - Math.floor(rate.minWeightKg || 0),
        );
        // task sample: ceil(weight) * perKg; we use full weight for simplicity
        total += Math.ceil(weightKg) * rate.pricePerKgCents;
      }

      return {
        id: rate.id,
        methodId: rate.shippingMethodId,
        methodName: rate.method.name,
        methodCode: rate.method.code,
        zoneName: rate.zone.name,
        warehouseName: rate.warehouse?.name ?? null,
        warehouseId: rate.warehouseId,
        priceCents: total,
        estimatedDaysMin: rate.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax,
      };
    });
  }
}
