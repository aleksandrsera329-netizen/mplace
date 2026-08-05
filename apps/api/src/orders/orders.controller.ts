import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CheckoutDto, UpdateOrderStatusDto } from './dto/checkout.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';

class StatusBodyDto extends UpdateOrderStatusDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('cart')
  getCart(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-key') sessionKey?: string,
  ) {
    return this.orders.getCart(user ?? null, sessionKey);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('cart/items')
  addItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-key') sessionKey: string | undefined,
    @Body() dto: AddCartItemDto,
  ) {
    return this.orders.addItem(user ?? null, sessionKey, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch('cart/items/:id')
  updateItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-key') sessionKey: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.orders.updateItem(user ?? null, sessionKey, id, dto.quantity);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Delete('cart')
  clearCart(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-key') sessionKey?: string,
  ) {
    return this.orders.clearCart(user ?? null, sessionKey);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 5, ttl: 10_000 },
    long: { limit: 15, ttl: 60_000 },
  })
  @Post('checkout')
  checkout(
    @CurrentUser() user: JwtPayload | undefined,
    @Headers('x-session-key') sessionKey: string | undefined,
    @Body() dto: CheckoutDto,
  ) {
    return this.orders.checkout(user ?? null, sessionKey, dto);
  }

  /** Removed: POST /orders/:id/pay — payment only via payment-intent + provider webhook */

  @UseGuards(JwtAuthGuard)
  @Get('orders')
  list(@CurrentUser() user: JwtPayload, @Query() dto: ListOrdersDto) {
    return this.orders.listOrders(user, {
      cursor: dto.cursor,
      limit: dto.limit,
      status: dto.status,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('orders/:id')
  get(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Headers('x-order-access-token') accessToken?: string,
  ) {
    // Token only via header — never query string (history/proxy logs)
    return this.orders.getOrder(user ?? null, id, accessToken);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.CUSTOMER)
  @Patch('orders/:id/status')
  status(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StatusBodyDto,
  ) {
    return this.orders.updateStatus(user, id, dto.status, dto.reason);
  }
}
