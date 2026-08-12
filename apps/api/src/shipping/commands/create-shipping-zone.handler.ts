import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShippingZoneCommand } from './create-shipping-zone.command';

@Injectable()
@CommandHandler(CreateShippingZoneCommand)
export class CreateShippingZoneHandler
  implements ICommandHandler<CreateShippingZoneCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateShippingZoneCommand) {
    if (!cmd.data?.name?.trim()) {
      throw new BadRequestException('Название зоны обязательно');
    }
    const countries = (cmd.data.countries || [])
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (!countries.length) {
      throw new BadRequestException('Укажите хотя бы одну страну (например RU)');
    }
    return this.prisma.shippingZone.create({
      data: {
        tenantId: cmd.tenantId,
        name: cmd.data.name.trim(),
        countries,
        regions: (cmd.data.regions || []).map((r) => r.trim()).filter(Boolean),
      },
    });
  }
}
