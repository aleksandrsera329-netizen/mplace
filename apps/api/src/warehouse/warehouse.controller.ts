import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getCurrentTenantId } from '../common/tenant/tenant.context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseCommand } from './commands/create-warehouse.command';
import { UpdateProductStockCommand } from './commands/update-product-stock.command';
import { UpdateWarehouseCommand } from './commands/update-warehouse.command';

class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateStockDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}

function resolveTenantId(user: JwtPayload): string | null {
  return getCurrentTenantId() || user.tenantId || null;
}

function requireShopId(user: JwtPayload): string {
  if (!user.shopId) {
    throw new BadRequestException('У пользователя нет магазина (shopId)');
  }
  return user.shopId;
}

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create warehouse for merchant shop' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateWarehouseDto,
  ) {
    return this.commandBus.execute(
      new CreateWarehouseCommand(
        resolveTenantId(user),
        requireShopId(user),
        body,
      ),
    );
  }

  @Get()
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List warehouses for merchant shop' })
  async list(@CurrentUser() user: JwtPayload) {
    const merchantId = requireShopId(user);
    return this.prisma.warehouse.findMany({
      where: { merchantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  @Post('stock')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upsert product stock at warehouse' })
  async updateStock(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateStockDto,
  ) {
    return this.commandBus.execute(
      new UpdateProductStockCommand(
        body.productId,
        body.warehouseId,
        body.quantity,
        requireShopId(user),
        resolveTenantId(user),
      ),
    );
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.prisma.warehouse.findFirst({
      where: { id, merchantId: requireShopId(user) },
      include: {
        stocks: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, stock: true },
            },
          },
        },
      },
    });
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateWarehouseDto,
  ) {
    return this.commandBus.execute(
      new UpdateWarehouseCommand(
        id,
        requireShopId(user),
        resolveTenantId(user),
        body,
      ),
    );
  }
}
