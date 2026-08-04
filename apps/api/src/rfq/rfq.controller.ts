import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateRfqDto,
  CreateRfqOfferDto,
  RfqMessageDto,
} from './dto/rfq.dto';
import { RfqService } from './rfq.service';

@Controller('rfq')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RfqController {
  constructor(private readonly rfq: RfqService) {}

  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  list(@CurrentUser() user: JwtPayload) {
    return this.rfq.listForUser(user);
  }

  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 5, ttl: 10_000 },
    long: { limit: 20, ttl: 60_000 },
  })
  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRfqDto) {
    return this.rfq.create(user, dto);
  }

  @Get(':id')
  @Roles(
    UserRole.CUSTOMER,
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rfq.get(id, user);
  }

  @Get(':id/compare')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  compare(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rfq.comparison(id, user);
  }

  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 8, ttl: 10_000 },
    long: { limit: 30, ttl: 60_000 },
  })
  @Post(':id/offers')
  @Roles(UserRole.MERCHANT)
  offer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateRfqOfferDto,
  ) {
    return this.rfq.createOffer(user, id, dto);
  }

  @Post(':id/award/:offerId')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  award(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('offerId') offerId: string,
  ) {
    return this.rfq.award(id, offerId, user);
  }

  @Post(':id/messages')
  @Roles(
    UserRole.CUSTOMER,
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  message(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RfqMessageDto,
  ) {
    return this.rfq.postMessage(id, user, dto);
  }
}
