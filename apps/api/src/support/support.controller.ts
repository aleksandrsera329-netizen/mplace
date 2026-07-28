import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SupportService } from './support.service';

class CreateTicketDto {
  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(3)
  body!: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class MessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

class CreateDisputeDto {
  @IsString()
  orderId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

class CreateRefundDto {
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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  tickets(@CurrentUser() user: JwtPayload) {
    return this.support.listTickets(user);
  }

  @Post('tickets')
  createTicket(@CurrentUser() user: JwtPayload, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(user, dto);
  }

  @Post('tickets/:id/messages')
  message(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MessageDto,
  ) {
    return this.support.addTicketMessage(user, id, dto.body);
  }

  @Roles(UserRole.ADMIN)
  @Patch('tickets/:id/status')
  ticketStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.support.updateTicketStatus(user, id, status as never);
  }

  @Get('disputes')
  disputes(@CurrentUser() user: JwtPayload) {
    return this.support.listDisputes(user);
  }

  @Post('disputes')
  createDispute(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.support.createDispute(user, dto.orderId, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @Patch('disputes/:id/resolve')
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('resolution') resolution: string,
  ) {
    return this.support.resolveDispute(user, id, resolution);
  }

  @Get('refunds')
  refunds(@CurrentUser() user: JwtPayload) {
    return this.support.listRefunds(user);
  }

  @Post('refunds')
  createRefund(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRefundDto,
  ) {
    return this.support.requestRefund(
      user,
      dto.orderId,
      dto.amountCents,
      dto.reason,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch('refunds/:id')
  decideRefund(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'REJECTED' | 'COMPLETED',
    @Body('adminNote') adminNote?: string,
  ) {
    return this.support.decideRefund(user, id, status, adminNote);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/audit')
  audit(@CurrentUser() user: JwtPayload) {
    return this.support.listAudit(user);
  }
}
