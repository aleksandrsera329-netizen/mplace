import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getCurrentTenantId } from '../common/tenant/tenant.context';
import { PrismaService } from '../prisma/prisma.service';
import { CalculateShippingCommand } from './commands/calculate-shipping.command';
import { CreateShippingMethodCommand } from './commands/create-shipping-method.command';
import { CreateShippingRateCommand } from './commands/create-shipping-rate.command';
import { CreateShippingZoneCommand } from './commands/create-shipping-zone.command';

class CreateMethodDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  merchantId?: string;
}

class CreateZoneDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  countries!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[];
}

class CreateRateDto {
  @IsString()
  shippingMethodId!: string;

  @IsString()
  shippingZoneId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxWeightKg?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pricePerKgCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estimatedDaysMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estimatedDaysMax?: number;
}

class CalculateDto {
  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg!: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;
}

function resolveTenantId(user?: JwtPayload | null): string | null {
  return getCurrentTenantId() || user?.tenantId || null;
}

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @Post('methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create shipping method' })
  async createMethod(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateMethodDto,
  ) {
    const merchantId =
      user.role === UserRole.MERCHANT
        ? user.shopId
        : body.merchantId || user.shopId || null;
    return this.commandBus.execute(
      new CreateShippingMethodCommand(resolveTenantId(user), merchantId, body),
    );
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  async listMethods(@CurrentUser() user: JwtPayload) {
    const tenantId = resolveTenantId(user);
    return this.prisma.shippingMethod.findMany({
      where: {
        OR: [
          ...(tenantId ? [{ tenantId }] : []),
          { tenantId: null },
          ...(user.shopId
            ? [{ merchantId: user.shopId }]
            : []),
        ],
      },
      include: {
        rates: {
          include: { zone: true, warehouse: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  async createZone(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateZoneDto,
  ) {
    return this.commandBus.execute(
      new CreateShippingZoneCommand(resolveTenantId(user), body),
    );
  }

  @Get('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  async listZones(@CurrentUser() user: JwtPayload) {
    const tenantId = resolveTenantId(user);
    return this.prisma.shippingZone.findMany({
      where: tenantId
        ? { OR: [{ tenantId }, { tenantId: null }] }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { rates: true } } },
    });
  }

  @Post('rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  async createRate(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateRateDto,
  ) {
    return this.commandBus.execute(
      new CreateShippingRateCommand(resolveTenantId(user), body),
    );
  }

  /** Public calculate for checkout (optional JWT for tenant context) */
  @Post('calculate')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Calculate shipping options' })
  async calculate(
    @Body() body: CalculateDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.commandBus.execute(
      new CalculateShippingCommand(resolveTenantId(user ?? null), body),
    );
  }
}
