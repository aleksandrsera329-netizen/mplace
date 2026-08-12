import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInviteCommand,
  InviteRoleInput,
} from './create-invite.command';

function mapInviteRole(role: InviteRoleInput): UserRole {
  const r = String(role).toUpperCase();
  if (r === 'BUYER' || r === 'CUSTOMER') return UserRole.CUSTOMER;
  if (r === 'MERCHANT') return UserRole.MERCHANT;
  if (r === 'TENANT_ADMIN' || r === 'ADMIN') return UserRole.ADMIN;
  throw new BadRequestException(
    'role: BUYER | MERCHANT | TENANT_ADMIN (или CUSTOMER | ADMIN)',
  );
}

@Injectable()
@CommandHandler(CreateInviteCommand)
export class CreateInviteHandler
  implements ICommandHandler<CreateInviteCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(cmd: CreateInviteCommand) {
    const email = cmd.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('Некорректный email');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: cmd.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant не найден');
    }

    // Isolation: inviter must belong to the target tenant (unless SUPER_ADMIN)
    const inviter = await this.prisma.user.findUnique({
      where: { id: cmd.invitedById },
      select: { id: true, role: true, tenantId: true },
    });
    if (!inviter) {
      throw new BadRequestException('Пригласивший пользователь не найден');
    }
    if (
      inviter.role !== UserRole.SUPER_ADMIN &&
      inviter.tenantId !== cmd.tenantId
    ) {
      throw new ForbiddenException(
        'Нельзя создавать приглашение в чужой tenant',
      );
    }

    const role = mapInviteRole(cmd.role);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }

    const invite = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenantInvite.findFirst({
        where: {
          tenantId: cmd.tenantId,
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (existing) {
        throw new BadRequestException('Приглашение уже отправлено');
      }

      // Upsert by unique [tenantId, email] — replace expired invite
      const prev = await tx.tenantInvite.findUnique({
        where: {
          tenantId_email: { tenantId: cmd.tenantId, email },
        },
      });
      if (prev) {
        await tx.tenantInvite.delete({ where: { id: prev.id } });
      }

      const created = await tx.tenantInvite.create({
        data: {
          tenantId: cmd.tenantId,
          email,
          role,
          token,
          expiresAt,
          invitedById: cmd.invitedById,
        },
      });

      await this.outbox.addToOutbox(tx, 'TenantInviteCreatedEvent', {
        inviteId: created.id,
        tenantId: cmd.tenantId,
        email,
        role,
        token,
        tenantName: tenant.name,
      });

      return created;
    });

    return invite;
  }
}
