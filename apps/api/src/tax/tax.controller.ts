import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
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
import { TaxService } from './tax.service';
import { CalculateTaxCommand } from './commands/calculate-tax.command';
import { CreateTaxRateCommand } from './commands/create-tax-rate.command';

class CreateTaxRateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  rate!: number;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class TaxItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceCents!: number;
}

class CalculateTaxDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxItemDto)
  items!: TaxItemDto[];

  @IsOptional()
  @IsString()
  country?: string;
}

function resolveTenantId(user?: JwtPayload | null): string | null {
  return getCurrentTenantId() || user?.tenantId || null;
}

@ApiTags('tax')
@Controller('tax')
export class TaxController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tax: TaxService,
  ) {}

  @Post('rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MERCHANT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create tax rate (VAT/НДС)' })
  async createRate(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateTaxRateDto,
  ) {
    return this.commandBus.execute(
      new CreateTaxRateCommand(resolveTenantId(user), body),
    );
  }

  @Get('rates')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List active tax rates' })
  async listRates(@CurrentUser() user?: JwtPayload) {
    return this.tax.listRates(resolveTenantId(user ?? null));
  }

  @Post('calculate')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Calculate tax for cart lines' })
  async calculate(
    @Body() body: CalculateTaxDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.commandBus.execute(
      new CalculateTaxCommand(
        resolveTenantId(user ?? null),
        body.items,
        body.country || 'RU',
      ),
    );
  }
}
