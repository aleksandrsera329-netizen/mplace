import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DemoRequestDto } from './dto/demo-request.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post('demo-request')
  @HttpCode(201)
  @Throttle({ default: { limit: 8, ttl: 3_600_000 } }) // 8 / hour
  @ApiOperation({ summary: 'Public: request private demo (email + optional Telegram)' })
  async demoRequest(@Body() dto: DemoRequestDto, @Req() req: Request) {
    const delivery = await this.leads.submitDemoRequest(dto, {
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    return {
      ok: true,
      message:
        'Request received. We will contact you shortly for a private demo.',
      delivery,
    };
  }
}
