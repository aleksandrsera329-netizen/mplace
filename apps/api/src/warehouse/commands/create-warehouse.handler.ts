import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseCommand } from './create-warehouse.command';

@Injectable()
@CommandHandler(CreateWarehouseCommand)
export class CreateWarehouseHandler
  implements ICommandHandler<CreateWarehouseCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateWarehouseCommand) {
    if (!cmd.merchantId) {
      throw new BadRequestException('У пользователя нет магазина (shopId)');
    }
    if (!cmd.data?.name?.trim()) {
      throw new BadRequestException('Название склада обязательно');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: cmd.merchantId },
    });
    if (!shop) {
      throw new NotFoundException('Магазин не найден');
    }

    const existingCount = await this.prisma.warehouse.count({
      where: { merchantId: cmd.merchantId },
    });
    const makeDefault = cmd.data.isDefault === true || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.warehouse.updateMany({
          where: { merchantId: cmd.merchantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const code = cmd.data.code?.trim() || null;
      if (code) {
        const clash = await tx.warehouse.findFirst({
          where: { merchantId: cmd.merchantId, code },
        });
        if (clash) {
          throw new BadRequestException('Код склада уже занят');
        }
      }

      return tx.warehouse.create({
        data: {
          tenantId: cmd.tenantId || shop.tenantId || null,
          merchantId: cmd.merchantId,
          name: cmd.data.name.trim(),
          code,
          address: cmd.data.address?.trim() || null,
          city: cmd.data.city?.trim() || null,
          country: cmd.data.country?.trim() || 'RU',
          isDefault: makeDefault,
          isActive: true,
        },
      });
    });
  }
}
