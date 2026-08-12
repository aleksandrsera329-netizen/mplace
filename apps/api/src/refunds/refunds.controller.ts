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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RefundsService } from './refunds.service';

class RequestRefundDto {
  @IsString()
  orderId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

class RejectBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}

@ApiTags('Refunds')
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.MERCHANT,
  )
  @ApiOperation({ summary: 'Request refund (status REQUESTED)' })
  request(@CurrentUser() user: JwtPayload, @Body() dto: RequestRefundDto) {
    return this.refunds.requestRefund(
      user,
      dto.orderId,
      dto.amountCents,
      dto.reason,
    );
  }

  @Get(':id')
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.MERCHANT,
  )
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.refunds.getOne(user, id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.payments_refund)
  @ApiOperation({ summary: 'Admin approve → APPROVED (never COMPLETED)' })
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.refunds.approveRefund(id, user.sub);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.payments_refund)
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: RejectBody,
  ) {
    return this.refunds.rejectRefund(id, user.sub, body.reason);
  }

  @Post(':id/provider')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.payments_refund)
  @ApiOperation({
    summary: 'Call Stripe refund → PROVIDER_REQUESTED (webhook completes)',
  })
  provider(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.refunds.requestProviderRefund(id, user.sub);
  }

  /** Hard-block any attempt to set COMPLETED via API */
  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  completeBlocked() {
    throw new BadRequestException(
      'COMPLETED is only set by provider webhook (charge.refunded / refund.updated)',
    );
  }
}
