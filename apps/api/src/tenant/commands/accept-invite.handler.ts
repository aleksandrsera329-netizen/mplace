import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AcceptInviteCommand } from './accept-invite.command';

@Injectable()
@CommandHandler(AcceptInviteCommand)
export class AcceptInviteHandler
  implements ICommandHandler<AcceptInviteCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(cmd: AcceptInviteCommand) {
    if (!cmd.password || cmd.password.length < 8) {
      throw new BadRequestException('Пароль должен быть не короче 8 символов');
    }

    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.tenantInvite.findUnique({
        where: { token: cmd.token },
        include: { tenant: true },
      });

      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new BadRequestException(
          'Приглашение недействительно или истекло',
        );
      }

      const existing = await tx.user.findUnique({
        where: { email: invite.email },
      });
      if (existing) {
        throw new ConflictException('Пользователь с таким email уже существует');
      }

      const passwordHash = await bcrypt.hash(cmd.password, 12);
      const nameParts = [cmd.firstName, cmd.lastName].filter(Boolean);
      const name =
        nameParts.length > 0
          ? nameParts.join(' ').trim()
          : invite.email.split('@')[0];

      const user = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          name,
          role: invite.role,
          status: UserStatus.ACTIVE,
          tenantId: invite.tenantId,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.tenantInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await this.outbox.addToOutbox(tx, 'TenantInviteAcceptedEvent', {
        inviteId: invite.id,
        tenantId: invite.tenantId,
        userId: user.id,
        email: invite.email,
      });

      const { passwordHash: _, ...safeUser } = user;
      return { user: safeUser, tenant: invite.tenant };
    });
  }
}
