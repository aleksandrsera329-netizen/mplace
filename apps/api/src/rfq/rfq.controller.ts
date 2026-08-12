import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { ListRfqDto } from './dto/list-rfq.dto';
import {
  CreateRfqDto,
  CreateRfqOfferDto,
  RfqMessageDto,
} from './dto/rfq.dto';
import { RfqService } from './rfq.service';
import { CreateRfqCommand } from './commands/create-rfq.command';
import { RespondToRfqCommand } from './commands/respond-to-rfq.command';
import { AcceptRfqResponseCommand } from './commands/accept-rfq-response.command';
import { RejectRfqResponseCommand } from './commands/reject-rfq-response.command';
import { CloseRfqCommand } from './commands/close-rfq.command';

class CloseBodyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class RejectBodyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class AwardBodyDto {
  @IsString()
  offerId!: string;
}

@Controller('rfq')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RfqController {
  constructor(
    private readonly rfq: RfqService,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  list(@CurrentUser() user: JwtPayload, @Query() dto: ListRfqDto) {
    return this.rfq.listForUser(user, {
      cursor: dto.cursor,
      limit: dto.limit,
      status: dto.status,
      incoming: dto.incoming,
    });
  }

  @Throttle(ThrottleLimits.RFQ_CREATE)
  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRfqDto) {
    return this.commandBus.execute(new CreateRfqCommand(user, dto));
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

  @Throttle(ThrottleLimits.RFQ_CREATE)
  @Post(':id/offers')
  @Roles(UserRole.MERCHANT)
  offer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateRfqOfferDto,
  ) {
    return this.commandBus.execute(new RespondToRfqCommand(user, id, dto));
  }

  /** Stage 12: POST /rfq/:id/award { offerId } */
  @Post(':id/award')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  awardBody(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AwardBodyDto,
  ) {
    return this.commandBus.execute(
      new AcceptRfqResponseCommand(user, id, dto.offerId),
    );
  }

  /** Legacy path: POST /rfq/:id/award/:offerId */
  @Post(':id/award/:offerId')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  award(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('offerId') offerId: string,
  ) {
    return this.commandBus.execute(
      new AcceptRfqResponseCommand(user, id, offerId),
    );
  }

  @Post(':id/offers/:offerId/reject')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  rejectOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('offerId') offerId: string,
    @Body() body: RejectBodyDto,
  ) {
    return this.commandBus.execute(
      new RejectRfqResponseCommand(user, id, offerId, body.reason),
    );
  }

  @Post(':id/close')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  close(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: CloseBodyDto,
  ) {
    return this.commandBus.execute(
      new CloseRfqCommand(user, id, body.reason),
    );
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
