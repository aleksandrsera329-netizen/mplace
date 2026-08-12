import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DocumentsService } from '../documents.service';
import { CreateActCommand } from './create-act.command';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
@CommandHandler(CreateActCommand)
export class CreateActHandler implements ICommandHandler<CreateActCommand> {
  constructor(private readonly documents: DocumentsService) {}

  execute(cmd: CreateActCommand) {
    const user = {
      sub: cmd.userId || '',
      role: (cmd.role as UserRole) || UserRole.ADMIN,
      shopId: cmd.shopId ?? null,
      tenantId: cmd.tenantId,
    } as JwtPayload;
    return this.documents.createActFromOrder(cmd.orderId, cmd.tenantId, user);
  }
}
