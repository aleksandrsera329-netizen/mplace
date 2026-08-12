import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt-payload.interface';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private meta(req: Request) {
    return {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  private refreshCookieOptions() {
    const isProd =
      (this.config.get<string>('NODE_ENV') || '') === 'production';
    const days = Number(this.config.get('REFRESH_TOKEN_DAYS') || 30);
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      maxAge: days * 24 * 60 * 60 * 1000,
      path: COOKIE_PATH,
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, this.refreshCookieOptions());
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      path: COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
      secure: (this.config.get<string>('NODE_ENV') || '') === 'production',
    });
  }

  private readRefreshToken(
    req: Request,
    bodyToken?: string,
  ): string | undefined {
    const fromCookie = (
      req as Request & { cookies?: Record<string, string> }
    ).cookies?.[REFRESH_COOKIE];
    return (fromCookie || bodyToken || '').trim() || undefined;
  }

  @Throttle(ThrottleLimits.LOGIN)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.meta(req));
    if (
      result &&
      typeof result === 'object' &&
      'refreshToken' in result &&
      typeof (result as { refreshToken?: string }).refreshToken === 'string'
    ) {
      this.setRefreshCookie(
        res,
        (result as { refreshToken: string }).refreshToken,
      );
    }
    return result;
  }

  /** Stage 6: complete MFA after password (tempToken from login) */
  @Throttle(ThrottleLimits.MFA)
  @Post('mfa/verify')
  async mfaVerify(
    @Body() body: { tempToken?: string; code?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.tempToken || !body?.code) {
      throw new UnauthorizedException('tempToken and code are required');
    }
    const result = await this.auth.verifyMfa(
      body.tempToken,
      body.code,
      this.meta(req),
    );
    if (result.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
    }
    return result;
  }

  /** Stage 6: TOTP setup during admin MFA enrollment (tempToken, no full session) */
  @Throttle(ThrottleLimits.MFA)
  @Post('mfa/setup')
  mfaSetup(@Body() body: { tempToken?: string }) {
    if (!body?.tempToken) {
      throw new UnauthorizedException('tempToken is required');
    }
    return this.auth.setupTotpWithTemp(body.tempToken);
  }

  @Throttle(ThrottleLimits.MFA)
  @Post('mfa/enable')
  mfaEnable(@Body() body: { tempToken?: string; code?: string }) {
    if (!body?.tempToken || !body?.code) {
      throw new UnauthorizedException('tempToken and code are required');
    }
    return this.auth.enableTotpWithTemp(body.tempToken, body.code);
  }

  @Throttle(ThrottleLimits.REFRESH)
  @Post('refresh')
  async refresh(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = this.readRefreshToken(req, dto?.refreshToken);
    if (!oldToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.auth.refresh(oldToken, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Throttle(ThrottleLimits.REFRESH)
  @Post('logout')
  async logout(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readRefreshToken(req, dto?.refreshToken);
    if (token) {
      await this.auth.logout(token);
    }
    this.clearRefreshCookie(res);
    return { ok: true, success: true };
  }

  @Throttle(ThrottleLimits.REGISTER)
  @Post('register')
  async register(
    @Body() dto: RegisterCustomerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.registerCustomer(dto, this.meta(req).ip);
    if (result.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
    }
    return result;
  }

  @Throttle(ThrottleLimits.REGISTER)
  @Post('register/merchant')
  async registerMerchant(
    @Body() dto: RegisterMerchantDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.registerMerchant(dto, this.meta(req).ip);
    if (result.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
    }
    return result;
  }

  @Throttle(ThrottleLimits.REGISTER)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Throttle(ThrottleLimits.PASSWORD_RESET)
  @Post('password/forgot')
  forgot(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto, this.meta(req).ip);
  }

  @Throttle(ThrottleLimits.PASSWORD_RESET)
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
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(ThrottleLimits.MFA)
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: JwtPayload) {
    return this.auth.setup2fa(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(ThrottleLimits.MFA)
  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: JwtPayload, @Body() dto: Enable2faDto) {
    return this.auth.enable2fa(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(ThrottleLimits.MFA)
  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: JwtPayload, @Body() dto: Enable2faDto) {
    return this.auth.disable2fa(user.sub, dto);
  }
}
