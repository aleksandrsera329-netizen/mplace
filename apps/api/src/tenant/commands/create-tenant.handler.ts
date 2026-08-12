import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantCommand } from './create-tenant.command';

@Injectable()
@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler
  implements ICommandHandler<CreateTenantCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateTenantCommand) {
    const { name, slug, ownerEmail, ownerPassword, ownerName, plan } = command;

    if (!name?.trim() || !slug?.trim()) {
      throw new BadRequestException('Название и slug обязательны');
    }

    if (!ownerEmail?.trim() || !ownerPassword || ownerPassword.length < 6) {
      throw new BadRequestException(
        'Email владельца и пароль (мин. 6 символов) обязательны',
      );
    }

    const normalizedSlug = slug.toLowerCase().trim();
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizedSlug)) {
      throw new BadRequestException(
        'Slug: только латиница, цифры и дефис (как поддомен)',
      );
    }

    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existingSlug) {
      throw new ConflictException('Такой slug уже занят');
    }

    const email = ownerEmail.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: name.trim(),
          slug: normalizedSlug,
          plan: plan || 'STARTER',
          status: 'ACTIVE',
        },
      });

      const owner = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: ownerName?.trim() || name.trim(),
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          tenantId: tenant.id,
        },
      });

      return { tenant, owner };
    });

    const { passwordHash: _, ...safeOwner } = result.owner;

    return {
      tenant: result.tenant,
      owner: safeOwner,
    };
  }
}
