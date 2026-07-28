import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ShopStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ShopsService } from './shops.service';

class UpdateShopStatusDto {
  @IsEnum(ShopStatus)
  status!: ShopStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

class UpdateShopProfileDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  payoutDetails?: string;
}

@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@CurrentUser() user?: JwtPayload) {
    return this.shops.list(user ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.shops.myShop(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShopProfileDto,
  ) {
    return this.shops.updateProfile(user, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.shops.get(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  status(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateShopStatusDto,
  ) {
    return this.shops.updateStatus(
      user,
      id,
      dto.status,
      dto.rejectionReason,
    );
  }
}
