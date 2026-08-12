import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateWarehouseCommand } from './update-warehouse.command';

@Injectable()
@CommandHandler(UpdateWarehouseCommand)
export class UpdateWarehouseHandler
  implements ICommandHandler<UpdateWarehouseCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateWarehouseCommand) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.warehouse.findFirst({
        where: { id: cmd.warehouseId, merchantId: cmd.merchantId },
      });
      if (!existing) {
        throw new NotFoundException('Склад не найден');
      }
      if (
        cmd.tenantId &&
        existing.tenantId &&
        existing.tenantId !== cmd.tenantId
      ) {
        throw new ForbiddenException('Нет доступа к этому складу');
      }

      if (cmd.data.isDefault === true) {
        await tx.warehouse.updateMany({
          where: { merchantId: existing.merchantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id: cmd.warehouseId },
        data: {
          name: cmd.data.name,
          code: cmd.data.code,
          address: cmd.data.address,
          city: cmd.data.city,
          country: cmd.data.country,
          isDefault: cmd.data.isDefault,
          isActive: cmd.data.isActive,
        },
      });
    });
  }
}
