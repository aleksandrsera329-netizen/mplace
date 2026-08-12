import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../../common/tenant/tenant.context';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { UpdateTenantBrandingCommand } from './update-tenant-branding.command';

const LOGO_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
]);
const FAVICON_MIME = new Set([
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/svg+xml',
  'image/webp',
  'image/jpeg',
]);

@Injectable()
@CommandHandler(UpdateTenantBrandingCommand)
export class UpdateTenantBrandingHandler
  implements ICommandHandler<UpdateTenantBrandingCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(command: UpdateTenantBrandingCommand) {
    const {
      tenantId,
      data,
      actorRole,
      actorTenantId,
      logoFile,
      faviconFile,
    } = command;
    const currentTenantId = getCurrentTenantId();
    const isSuperAdmin = actorRole === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      if (currentTenantId && currentTenantId !== tenantId) {
        throw new ForbiddenException('Нельзя менять чужой tenant');
      }
      if (actorTenantId && actorTenantId !== tenantId) {
        throw new ForbiddenException('Нельзя менять чужой tenant');
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant не найден');
    }

    let logoUrl = data.logoUrl;
    let faviconUrl = data.faviconUrl;
    const folder = `tenants/${tenantId}/branding`;

    if (logoFile) {
      this.assertMime(logoFile, LOGO_MIME, 'logo');
      if (logoFile.size > 2 * 1024 * 1024) {
        throw new BadRequestException('Логотип: максимум 2 MB');
      }
      logoUrl = await this.storage.uploadImage(logoFile, folder);
    }

    if (faviconFile) {
      this.assertMime(faviconFile, FAVICON_MIME, 'favicon');
      if (faviconFile.size > 512 * 1024) {
        throw new BadRequestException('Favicon: максимум 512 KB');
      }
      // Prefer raw file for ico/svg; images go through webp pipeline
      if (
        faviconFile.mimetype === 'image/svg+xml' ||
        faviconFile.mimetype === 'image/x-icon' ||
        faviconFile.mimetype === 'image/vnd.microsoft.icon'
      ) {
        faviconUrl = await this.storage.uploadFile(faviconFile, folder);
      } else {
        faviconUrl = await this.storage.uploadImage(faviconFile, folder);
      }
    }

    if (
      data.domain !== undefined &&
      data.domain !== null &&
      data.domain !== ''
    ) {
      const domain = data.domain.trim().toLowerCase();
      const existing = await this.prisma.tenant.findFirst({
        where: { domain, id: { not: tenantId } },
      });
      if (existing) {
        throw new ConflictException('Этот домен уже занят');
      }
    }

    const update: Prisma.TenantUpdateInput = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (logoUrl !== undefined) update.logoUrl = logoUrl;
    if (faviconUrl !== undefined) update.faviconUrl = faviconUrl;
    if (data.primaryColor !== undefined) update.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined)
      update.secondaryColor = data.secondaryColor;
    if (data.accentColor !== undefined) update.accentColor = data.accentColor;
    if (data.emailFromName !== undefined)
      update.emailFromName = data.emailFromName;
    if (data.emailFromAddress !== undefined)
      update.emailFromAddress = data.emailFromAddress;
    if (data.domain !== undefined) {
      update.domain =
        data.domain === null || data.domain === ''
          ? null
          : data.domain.trim().toLowerCase();
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: update,
    });
  }

  private assertMime(
    file: Express.Multer.File,
    allowed: Set<string>,
    label: string,
  ) {
    const mime = (file.mimetype || '').toLowerCase();
    if (!allowed.has(mime)) {
      throw new BadRequestException(
        `${label}: недопустимый тип ${mime || 'unknown'}`,
      );
    }
  }
}
