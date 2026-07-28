import {
  Body,
  Controller,
  Headers,
  Ip,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

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

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(OptionalJwtAuthGuard)
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

  @Post('payments/webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw = req.rawBody;
    if (!raw) {
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
