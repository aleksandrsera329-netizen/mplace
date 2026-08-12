import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShippingMethodCommand } from './create-shipping-method.command';

@Injectable()
@CommandHandler(CreateShippingMethodCommand)
export class CreateShippingMethodHandler
  implements ICommandHandler<CreateShippingMethodCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateShippingMethodCommand) {
    if (!cmd.data?.name?.trim()) {
      throw new BadRequestException('Название метода обязательно');
    }
    return this.prisma.shippingMethod.create({
      data: {
        tenantId: cmd.tenantId,
        merchantId: cmd.merchantId,
        name: cmd.data.name.trim(),
        code: cmd.data.code?.trim() || null,
        description: cmd.data.description?.trim() || null,
        isActive: cmd.data.isActive ?? true,
      },
    });
  }
}
