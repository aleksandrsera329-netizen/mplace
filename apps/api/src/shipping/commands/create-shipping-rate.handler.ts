import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShippingRateCommand } from './create-shipping-rate.command';

@Injectable()
@CommandHandler(CreateShippingRateCommand)
export class CreateShippingRateHandler
  implements ICommandHandler<CreateShippingRateCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateShippingRateCommand) {
    const { shippingMethodId, shippingZoneId, priceCents } = cmd.data;
    if (!shippingMethodId || !shippingZoneId) {
      throw new BadRequestException('method и zone обязательны');
    }
    if (priceCents == null || priceCents < 0) {
      throw new BadRequestException('priceCents >= 0');
    }

    const method = await this.prisma.shippingMethod.findUnique({
      where: { id: shippingMethodId },
    });
    if (!method) throw new NotFoundException('Метод доставки не найден');

    const zone = await this.prisma.shippingZone.findUnique({
      where: { id: shippingZoneId },
    });
    if (!zone) throw new NotFoundException('Зона не найдена');

    return this.prisma.shippingRate.create({
      data: {
        shippingMethodId,
        shippingZoneId,
        warehouseId: cmd.data.warehouseId || null,
        minWeightKg: cmd.data.minWeightKg ?? 0,
        maxWeightKg: cmd.data.maxWeightKg ?? null,
        priceCents,
        pricePerKgCents: cmd.data.pricePerKgCents ?? null,
        estimatedDaysMin: cmd.data.estimatedDaysMin ?? null,
        estimatedDaysMax: cmd.data.estimatedDaysMax ?? null,
        isActive: true,
      },
      include: { method: true, zone: true, warehouse: true },
    });
  }
}
