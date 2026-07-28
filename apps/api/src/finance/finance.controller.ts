import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinanceService } from './finance.service';

class RequestPayoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class DecidePayoutDto {
  @IsIn(['APPROVED', 'REJECTED', 'PAID'])
  decision!: 'APPROVED' | 'REJECTED' | 'PAID';

  @IsOptional()
  @IsString()
  adminNote?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Roles(UserRole.MERCHANT)
  @Get('merchant/balance')
  myBalance(@CurrentUser() user: JwtPayload) {
    return this.finance.myBalance(user);
  }

  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Get('payouts')
  listPayouts(@CurrentUser() user: JwtPayload) {
    return this.finance.listPayouts(user);
  }

  @Roles(UserRole.MERCHANT)
  @Post('payouts')
  request(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.finance.requestPayout(user, dto.amountCents, dto.note);
  }

  @Roles(UserRole.ADMIN)
  @Patch('payouts/:id')
  decide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DecidePayoutDto,
  ) {
    return this.finance.decidePayout(user, id, dto.decision, dto.adminNote);
  }

  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Get('ledger')
  ledger(
    @CurrentUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
  ) {
    return this.finance.listLedger(user, shopId);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/reports/summary')
  reports(@CurrentUser() user: JwtPayload) {
    return this.finance.reportsSummary(user);
  }
}
