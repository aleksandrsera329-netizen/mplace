import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DocumentsService } from '../documents.service';
import { CreateInvoiceCommand } from './create-invoice.command';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceHandler
  implements ICommandHandler<CreateInvoiceCommand>
{
  constructor(private readonly documents: DocumentsService) {}

  execute(cmd: CreateInvoiceCommand) {
    const user = {
      sub: cmd.userId || '',
      role: (cmd.role as UserRole) || UserRole.ADMIN,
      shopId: cmd.shopId ?? null,
      tenantId: cmd.tenantId,
    } as JwtPayload;
    return this.documents.createInvoiceFromOrder(
      cmd.orderId,
      cmd.tenantId,
      user,
    );
  }
}
