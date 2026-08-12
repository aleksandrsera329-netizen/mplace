import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getCurrentTenantId } from '../common/tenant/tenant.context';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteCommand } from './commands/accept-invite.command';
import { CreateInviteCommand } from './commands/create-invite.command';
import { CreateTenantCommand } from './commands/create-tenant.command';
import { UpdateTenantBrandingCommand } from './commands/update-tenant-branding.command';

class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i, {
    message: 'slug must be subdomain-safe',
  })
  slug!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(6)
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}

class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['BUYER', 'MERCHANT', 'TENANT_ADMIN', 'CUSTOMER', 'ADMIN'])
  role!: 'BUYER' | 'MERCHANT' | 'TENANT_ADMIN' | 'CUSTOMER' | 'ADMIN';
}

class AcceptInviteDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

const brandingSelect = {
  id: true,
  name: true,
  slug: true,
  domain: true,
  logoUrl: true,
  faviconUrl: true,
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
} as const;

function parseBrandingBody(body: Record<string, string | undefined>) {
  return {
    name: body.name,
    primaryColor: body.primaryColor,
    secondaryColor: body.secondaryColor,
    accentColor: body.accentColor,
    logoUrl: body.logoUrl,
    faviconUrl: body.faviconUrl,
    emailFromName: body.emailFromName,
    emailFromAddress: body.emailFromAddress,
    domain: body.domain ?? body.customDomain,
  };
}

function resolveTenantId(
  user: JwtPayload,
  explicit?: string,
): string {
  const fromHeader = getCurrentTenantId();
  const id =
    explicit ||
    fromHeader ||
    user.tenantId ||
    null;
  if (!id) {
    throw new BadRequestException(
      'Tenant не определён (X-Tenant-Id / user.tenantId / param)',
    );
  }
  return id;
}

/** Public + authenticated tenant APIs */
@ApiTags('tenants')
@Controller('tenants')
export class TenantPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Current tenant branding (header/subdomain)' })
  async getCurrentTenant() {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return null;
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: brandingSelect,
    });
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Tenant branding by slug (public)' })
  async getBySlug(@Param('slug') slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: brandingSelect,
    });
  }

  /** Authenticated: branding for the caller's tenant (or header) */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My tenant branding (JWT tenantId or header)' })
  async getMine(@CurrentUser() user: JwtPayload) {
    const tenantId = getCurrentTenantId() || user.tenantId;
    if (!tenantId) return null;
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        ...brandingSelect,
        emailFromName: true,
        emailFromAddress: true,
        plan: true,
        status: true,
      },
    });
  }

  @Patch('current/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Update current tenant branding (+ logo/favicon)' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'favicon', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024 },
      },
    ),
  )
  async updateCurrentBranding(
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    const tenantId = resolveTenantId(user, body.tenantId);
    return this.commandBus.execute(
      new UpdateTenantBrandingCommand(
        tenantId,
        parseBrandingBody(body),
        user.role,
        user.tenantId ?? null,
        files?.logo?.[0],
        files?.favicon?.[0],
      ),
    );
  }

  @Post('invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite user to tenant' })
  async createInvite(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateInviteDto,
  ) {
    const tenantId = resolveTenantId(user);
    return this.commandBus.execute(
      new CreateInviteCommand(tenantId, body.email, body.role, user.sub),
    );
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tenant invites' })
  async listInvites(@CurrentUser() user: JwtPayload) {
    const tenantId = resolveTenantId(user);
    return this.prisma.tenantInvite.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        token: true,
      },
    });
  }

  @Post('invites/accept')
  @ApiOperation({ summary: 'Accept invite and create user' })
  async acceptInvite(@Body() body: AcceptInviteDto) {
    return this.commandBus.execute(
      new AcceptInviteCommand(
        body.token,
        body.password,
        body.firstName,
        body.lastName,
      ),
    );
  }

  @Get('invites/preview/:token')
  @ApiOperation({ summary: 'Preview invite (public, no password)' })
  async previewInvite(@Param('token') token: string) {
    const invite = await this.prisma.tenantInvite.findUnique({
      where: { token },
      include: { tenant: { select: { name: true, logoUrl: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return { valid: false };
    }
    return {
      valid: true,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      tenantName: invite.tenant.name,
      tenantLogo: invite.tenant.logoUrl,
    };
  }
}

/** SUPER_ADMIN tenant management */
@ApiTags('admin-tenants')
@ApiBearerAuth()
@Controller('admin/tenants')
export class TenantAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create tenant + owner (SUPER_ADMIN)' })
  async create(@Body() dto: CreateTenantDto) {
    return this.commandBus.execute(
      new CreateTenantCommand(
        dto.name,
        dto.slug,
        dto.ownerEmail,
        dto.ownerPassword,
        dto.ownerName,
        dto.plan || 'STARTER',
      ),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all tenants' })
  async list() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        primaryColor: true,
        status: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tenant by id' })
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.tenantId &&
      user.tenantId !== id
    ) {
      return null;
    }
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  @Patch(':id/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Update tenant branding by id' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'favicon', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024 },
      },
    ),
  )
  async updateBranding(
    @Param('id') tenantId: string,
    @Body() body: Record<string, string>,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles()
    files?: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    return this.commandBus.execute(
      new UpdateTenantBrandingCommand(
        tenantId,
        parseBrandingBody(body || {}),
        user.role,
        user.tenantId ?? null,
        files?.logo?.[0],
        files?.favicon?.[0],
      ),
    );
  }
}
