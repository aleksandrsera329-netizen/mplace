import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  Enable2faDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RefreshTokenDto,
  RegisterCustomerDto,
  RegisterMerchantDto,
  VerifyEmailDto,
} from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: Request) {
    return {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.meta(req));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  logout(@Body() dto: Partial<RefreshTokenDto>) {
    return this.auth.logout(dto?.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterCustomerDto, @Req() req: Request) {
    return this.auth.registerCustomer(dto, this.meta(req).ip);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/merchant')
  registerMerchant(@Body() dto: RegisterMerchantDto, @Req() req: Request) {
    return this.auth.registerMerchant(dto, this.meta(req).ip);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  forgot(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto, this.meta(req).ip);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  reset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: JwtPayload) {
    return this.auth.setup2fa(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: JwtPayload, @Body() dto: Enable2faDto) {
    return this.auth.enable2fa(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: JwtPayload, @Body() dto: Enable2faDto) {
    return this.auth.disable2fa(user.sub, dto);
  }
}
