import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinanceService } from '../finance/finance.service';
import { MerchantService } from './merchant.service';

/**
 * Stage 15: Merchant cabinet — MERCHANT only, scoped to user.shopId.
 */
@ApiTags('Merchant')
@Controller('merchant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class MerchantController {
  constructor(
    private readonly merchant: MerchantService,
    private readonly finance: FinanceService,
  ) {}

  private shopId(user: JwtPayload): string {
    return this.merchant.requireShopId(user);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Merchant overview: GMV, balance, orders, RFQ, KYC' })
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.merchant.getDashboard(this.shopId(user));
  }

  @Get('orders')
  @ApiOperation({
    summary:
      'Shop orders (status: active|pending|paid|completed|cancelled|OrderStatus)',
  })
  orders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.merchant.getOrders(this.shopId(user), status);
  }

  @Get('rfqs')
  @ApiOperation({
    summary:
      'Merchant RFQs: own offers (pending|accepted|rejected) or incoming matches',
  })
  rfqs(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.merchant.getRfqs(this.shopId(user), status);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Available balance (ledger)' })
  balance(@CurrentUser() user: JwtPayload) {
    // Reuse finance service for consistent balance calc
    return this.finance.myBalance(user);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Payout requests for this shop' })
  payouts(@CurrentUser() user: JwtPayload) {
    return this.finance.listPayouts(user);
  }

  @Get('kyc')
  @ApiOperation({ summary: 'KYC documents & shop verification status' })
  kyc(@CurrentUser() user: JwtPayload) {
    return this.merchant.getKyc(this.shopId(user));
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Lightweight analytics snapshot (same as dashboard stats)' })
  async analytics(@CurrentUser() user: JwtPayload) {
    const dash = await this.merchant.getDashboard(this.shopId(user));
    return {
      shopId: this.shopId(user),
      stats: dash.stats,
    };
  }
}
