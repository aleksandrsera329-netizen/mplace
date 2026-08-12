import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';

class PaymentIntentDto {
  @IsOptional()
  @IsString()
  paymentToken?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class DevConfirmDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  paymentToken?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class RefundPaymentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripeConnect: StripeConnectService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Merchant: create Express Connect account (if needed) + onboarding URL.
   * POST /api/connect/onboard
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Post('connect/onboard')
  async startOnboarding(@CurrentUser() user: JwtPayload) {
    if (!user.shopId) {
      throw new BadRequestException('No shop linked to merchant');
    }
    if (!user.email) {
      throw new BadRequestException('Merchant email required for Stripe');
    }

    await this.stripeConnect.createConnectedAccount(user.shopId, user.email);

    const baseUrl =
      this.config.get<string>('APP_PUBLIC_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://127.0.0.1:8088';

    return this.stripeConnect.createAccountLink(
      user.shopId,
      `${baseUrl}/merchant.html?stripe=refresh`,
      `${baseUrl}/merchant.html?stripe=return`,
    );
  }

  /**
   * Merchant: sync + return Connect status.
   * GET /api/connect/status
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Get('connect/status')
  getConnectStatus(@CurrentUser() user: JwtPayload) {
    if (!user.shopId) {
      throw new BadRequestException('No shop linked to merchant');
    }
    return this.stripeConnect.syncAccountStatus(user.shopId);
  }

  /**
   * Admin: Stripe refund (full or partial) for paid order.
   * POST /api/orders/:id/refund
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('orders/:id/refund')
  refundOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.payments.refundPayment(
      id,
      dto.amountCents,
      dto.reason,
      user.sub,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(ThrottleLimits.PAYMENT)
  @Post('orders/:id/payment-intent')
  createIntent(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Body() dto: PaymentIntentDto,
    @Headers('x-order-access-token') headerToken?: string,
  ) {
    return this.payments.createPaymentIntent(
      user ?? null,
      id,
      dto.paymentToken || headerToken,
      dto.idempotencyKey,
    );
  }

  /**
   * Stripe webhooks (no JWT). Prefer this path with Nest rawBody.
   * Alias: POST /api/webhooks/stripe
   * SkipThrottle: provider retries must not hit 429.
   */
  @SkipThrottle()
  @Post('payments/webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.dispatchStripeWebhook(req, signature);
  }

  /** Stage 7 alias matching common Stripe dashboard path */
  @SkipThrottle()
  @Post('webhooks/stripe')
  webhookStripeAlias(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.dispatchStripeWebhook(req, signature);
  }

  private dispatchStripeWebhook(
    req: RawBodyRequest<Request>,
    signature?: string,
  ) {
    const raw = req.rawBody;
    if (!raw?.length) {
      // Fallback only when rawBody middleware missing (dev) — signature will fail in prod
      return this.payments.handleStripeWebhook(
        Buffer.from(JSON.stringify(req.body || {})),
        signature,
      );
    }
    return this.payments.handleStripeWebhook(raw, signature);
  }

  /**
   * Local-only. Never expose secret to browsers.
   * Returns 404 when not allowed (looks like missing route in staging/prod).
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('payments/dev-confirm')
  devConfirm(
    @CurrentUser() user: JwtPayload | undefined,
    @Body() dto: DevConfirmDto,
    @Headers('x-dev-payment-secret') secret?: string,
    @Headers('x-order-access-token') headerToken?: string,
    @Ip() ip?: string,
  ) {
    if (!this.payments.isDevConfirmEnabled()) {
      throw new NotFoundException();
    }
    return this.payments.devConfirm({
      orderId: dto.orderId,
      paymentToken: dto.paymentToken || headerToken,
      user: user ?? null,
      secretHeader: secret,
      idempotencyKey: dto.idempotencyKey,
      clientIp: ip,
    });
  }
}
