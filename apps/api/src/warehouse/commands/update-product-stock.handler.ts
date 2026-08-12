import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProductStockCommand } from './update-product-stock.command';

@Injectable()
@CommandHandler(UpdateProductStockCommand)
export class UpdateProductStockHandler
  implements ICommandHandler<UpdateProductStockCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateProductStockCommand) {
    if (cmd.quantity < 0 || !Number.isFinite(cmd.quantity)) {
      throw new BadRequestException('quantity >= 0');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: cmd.productId },
      select: { id: true, shopId: true },
    });
    if (!product) {
      throw new NotFoundException('Товар не найден');
    }
    if (product.shopId !== cmd.merchantId) {
      throw new ForbiddenException('Товар другого магазина');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: cmd.warehouseId,
        merchantId: cmd.merchantId,
      },
    });
    if (!warehouse) {
      throw new NotFoundException('Склад не найден');
    }
    if (
      cmd.tenantId &&
      warehouse.tenantId &&
      warehouse.tenantId !== cmd.tenantId
    ) {
      throw new ForbiddenException('Нет доступа к складу');
    }

    const stock = await this.prisma.productStock.upsert({
      where: {
        productId_warehouseId: {
          productId: cmd.productId,
          warehouseId: cmd.warehouseId,
        },
      },
      create: {
        productId: cmd.productId,
        warehouseId: cmd.warehouseId,
        quantity: Math.floor(cmd.quantity),
      },
      update: {
        quantity: Math.floor(cmd.quantity),
      },
      include: { warehouse: true },
    });

    // Sync aggregate Product.stock for catalog/checkout
    const agg = await this.prisma.productStock.aggregate({
      where: { productId: cmd.productId },
      _sum: { quantity: true },
    });
    await this.prisma.product.update({
      where: { id: cmd.productId },
      data: { stock: agg._sum.quantity ?? 0 },
    });

    return stock;
  }
}
