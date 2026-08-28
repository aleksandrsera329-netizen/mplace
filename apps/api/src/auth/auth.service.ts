import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { patchRequestContext } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import {
  Enable2faDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterCustomerDto,
  RegisterMerchantDto,
  VerifyEmailDto,
} from './dto/register.dto';
import { JwtPayload } from './jwt-payload.interface';
import {
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotp,
} from './totp.util';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
/** Access JWT TTL (Config JWT_EXPIRES_IN default 15m) */
const ACCESS_TOKEN_TTL_DEFAULT = '15m';
/** Refresh opaque token lifetime */
const REFRESH_TOKEN_TTL_DAYS_DEFAULT = 30;

@Injectable()
export class AuthService {
  private readonly slog: StructuredLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    structuredLogger: StructuredLogger,
  ) {
    this.slog = structuredLogger.child('AuthService');
  }

  private isProd(): boolean {
    return (this.config.get<string>('NODE_ENV') || '') === 'production';
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private refreshTtlDays(): number {
    const n = Number(
      this.config.get('REFRESH_TOKEN_DAYS') || REFRESH_TOKEN_TTL_DAYS_DEFAULT,
    );
    return Number.isFinite(n) && n > 0 ? n : REFRESH_TOKEN_TTL_DAYS_DEFAULT;
  }

  private refreshExpiresAt(): Date {
    return new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000);
  }

  private async audit(
    action: string,
    opts: {
      actorId?: string | null;
      entityType?: string;
      entityId?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    } = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: opts.actorId ?? null,
        action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        ip: opts.ip,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  }

  /**
   * Issue access JWT + new refresh family (login / register).
   */
  private async issueTokens(
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      shopId: string | null;
      phone?: string | null;
      twoFactorEnabled?: boolean;
      emailVerifiedAt?: Date | null;
    },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: (this.config.get('JWT_EXPIRES_IN') ||
        ACCESS_TOKEN_TTL_DEFAULT) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const familyId = randomUUID();
    const refreshRaw = this.generateRefreshToken();
    const tokenHash = this.hashToken(refreshRaw);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt: this.refreshExpiresAt(),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      tokenType: 'Bearer' as const,
      expiresIn: this.config.get('JWT_EXPIRES_IN') || ACCESS_TOKEN_TTL_DEFAULT,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone ?? null,
        name: user.name,
        role: user.role,
        shopId: user.shopId,
        twoFactorEnabled: !!user.twoFactorEnabled,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  /**
   * Rotate refresh token within the same family.
   * Reuse of a revoked token → revoke entire family (theft detection).
   */
  async refresh(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // === Reuse detection: already rotated/revoked token presented again ===
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit('REFRESH_REUSE_DETECTED', {
        actorId: existing.userId,
        entityType: 'RefreshToken',
        entityId: existing.id,
        ip: meta?.ip,
        meta: { familyId: existing.familyId },
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions in this family revoked. Please login again.',
      );
    }

    if (existing.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = existing.user;
    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.INACTIVE
    ) {
      await this.revokeFamily(existing.familyId);
      throw new ForbiddenException('Account suspended');
    }

    // Rotation: new token same family
    const newRefreshRaw = this.generateRefreshToken();
    const newHash = this.hashToken(newRefreshRaw);
    const newToken = await this.prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        familyId: existing.familyId,
        tokenHash: newHash,
        expiresAt: this.refreshExpiresAt(),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedBy: newToken.id,
      },
    });

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shopId,
      } satisfies JwtPayload,
      {
        expiresIn: (this.config.get('JWT_EXPIRES_IN') ||
          ACCESS_TOKEN_TTL_DEFAULT) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await this.audit('REFRESH_ROTATED', {
      actorId: user.id,
      entityType: 'RefreshToken',
      entityId: newToken.id,
      ip: meta?.ip,
      meta: { familyId: existing.familyId, replaced: existing.id },
    });

    return {
      accessToken,
      refreshToken: newRefreshRaw,
      tokenType: 'Bearer' as const,
      expiresIn: this.config.get('JWT_EXPIRES_IN') || ACCESS_TOKEN_TTL_DEFAULT,
    };
  }

  /** Revoke single token (logout current session). */
  async revokeToken(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async registerCustomer(dto: RegisterCustomerDto, ip?: string) {
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;
    if (!email && !phone) {
      throw new BadRequestException('Email or phone required');
    }
    if (email) {
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) throw new ConflictException('Email already registered');
    }
    if (phone) {
      const exists = await this.prisma.user.findUnique({ where: { phone } });
      if (exists) throw new ConflictException('Phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = email ? randomBytes(32).toString('hex') : null;
    const user = await this.prisma.user.create({
      data: {
        email: email || `phone_${phone}@mplace.local`,
        phone,
        passwordHash,
        name: dto.name.trim(),
        role: UserRole.CUSTOMER,
        status: email ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE,
        emailVerifyToken: emailVerifyToken
          ? this.hashToken(emailVerifyToken)
          : null,
        emailVerifyExpires: emailVerifyToken
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : null,
        emailVerifiedAt: email ? null : new Date(),
        phoneVerifiedAt: phone && !email ? new Date() : null,
      },
    });
    await this.audit('AUTH_REGISTER', {
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      ip,
      meta: { role: 'CUSTOMER' },
    });

    if (email && emailVerifyToken) {
      await this.notifications.sendEmailVerification(email, emailVerifyToken);
    }

    // Dev: return verify token so UI/tests can confirm without SMTP
    const tokens = await this.issueTokens(user, { ip });
    return {
      ...tokens,
      emailVerificationToken: this.isProd() ? undefined : emailVerifyToken,
      message: email
        ? 'Registered. Verify email to unlock full access.'
        : 'Registered with phone.',
    };
  }

  async registerMerchant(dto: RegisterMerchantDto, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already registered');

    const slugBase = dto.shopSlug?.trim() || this.slugify(dto.shopName);
    let slug = slugBase;
    let i = 1;
    while (await this.prisma.shop.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${i++}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = randomBytes(32).toString('hex');
    const shop = await this.prisma.shop.create({
      data: {
        name: dto.shopName.trim(),
        slug,
        status: ShopStatus.PENDING,
        verified: false,
      },
    });
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
        name: dto.name.trim(),
        role: UserRole.MERCHANT,
        status: UserStatus.PENDING_VERIFICATION,
        shopId: shop.id,
        emailVerifyToken: this.hashToken(emailVerifyToken),
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.audit('AUTH_REGISTER_MERCHANT', {
      actorId: user.id,
      entityType: 'Shop',
      entityId: shop.id,
      ip,
    });
    await this.notifications.sendEmailVerification(email, emailVerifyToken);

    const tokens = await this.issueTokens(user, { ip });
    return {
      ...tokens,
      emailVerificationToken: this.isProd() ? undefined : emailVerifyToken,
      message: 'Merchant registered. Shop pending KYC approval.',
    };
  }

  async login(
    dto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const started = Date.now();
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();
    if (!email && !phone) {
      throw new BadRequestException('Email or phone required');
    }

    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : await this.prisma.user.findUnique({ where: { phone: phone! } });

    if (!user) {
      await this.audit('LOGIN_FAIL', {
        ip: meta?.ip,
        meta: { email, phone, reason: 'not_found' },
      });
      this.slog.warn('Login failed', {
        status: 'unauthorized',
        durationMs: Date.now() - started,
        error: 'not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    patchRequestContext({ userId: user.id, shopId: user.shopId || undefined });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit('LOGIN_LOCKED', {
        actorId: user.id,
        ip: meta?.ip,
        meta: { until: user.lockedUntil.toISOString() },
      });
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}. Try again later.`,
      );
    }

    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.INACTIVE
    ) {
      throw new ForbiddenException('Account suspended');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1;
      const data: {
        failedLoginAttempts: number;
        lockedUntil?: Date;
      } = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED) {
        data.lockedUntil = new Date(
          Date.now() + LOCK_MINUTES * 60 * 1000,
        );
        data.failedLoginAttempts = 0;
      }
      await this.prisma.user.update({ where: { id: user.id }, data });
      await this.audit('LOGIN_FAIL', {
        actorId: user.id,
        ip: meta?.ip,
        meta: { attempts, locked: !!data.lockedUntil },
      });
      throw new UnauthorizedException(
        data.lockedUntil
          ? `Too many failed attempts. Locked for ${LOCK_MINUTES} minutes.`
          : 'Invalid credentials',
      );
    }

    const isAdminRole =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    const allowDemoLogin = ['true', '1', 'yes'].includes(
      String(this.config.get<string>('ALLOW_DEMO_LOGIN') || '')
        .toLowerCase()
        .trim(),
    );
    const nodeEnv = String(this.config.get<string>('NODE_ENV') || '').toLowerCase();
    const skipAdminMfaEnroll =
      allowDemoLogin && nodeEnv !== 'production' && nodeEnv !== 'staging';

    // Stage 6: ADMIN / SUPER_ADMIN must use TOTP (mandatory MFA).
    // Spec: development + ALLOW_DEMO_LOGIN skips enrollment so demo admins can log in.
    if (isAdminRole && !(skipAdminMfaEnroll && !user.twoFactorEnabled)) {
      if (!user.twoFactorEnabled) {
        const tempToken = await this.signMfaTempToken(user.id, 'mfa_enroll');
        await this.audit('LOGIN_MFA_ENROLL_REQUIRED', {
          actorId: user.id,
          ip: meta?.ip,
        });
        return {
          mfaRequired: true,
          mfaEnrollmentRequired: true,
          requires2fa: true,
          tempToken,
          partialToken: tempToken,
          message:
            'Admin MFA is mandatory. Complete TOTP setup via POST /auth/mfa/setup then /auth/mfa/enable, then /auth/mfa/verify',
        };
      }
      if (!dto.totpCode) {
        const tempToken = await this.signMfaTempToken(user.id, 'mfa');
        return {
          mfaRequired: true,
          requires2fa: true,
          tempToken,
          partialToken: tempToken,
          message: 'Enter TOTP code (POST /auth/mfa/verify or resend login with totpCode)',
        };
      }
      if (
        !user.twoFactorSecret ||
        !verifyTotp(user.twoFactorSecret, dto.totpCode)
      ) {
        await this.audit('LOGIN_2FA_FAIL', { actorId: user.id, ip: meta?.ip });
        throw new UnauthorizedException('Invalid 2FA code');
      }
    } else if (user.twoFactorEnabled) {
      // Non-admin optional 2FA
      if (!dto.totpCode) {
        const tempToken = await this.signMfaTempToken(user.id, 'mfa');
        return {
          requires2fa: true,
          mfaRequired: true,
          tempToken,
          partialToken: tempToken,
          message: 'Enter TOTP code from authenticator app',
        };
      }
      if (
        !user.twoFactorSecret ||
        !verifyTotp(user.twoFactorSecret, dto.totpCode)
      ) {
        await this.audit('LOGIN_2FA_FAIL', { actorId: user.id, ip: meta?.ip });
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    return this.finalizeLogin(user, meta);
  }

  private async signMfaTempToken(
    userId: string,
    purpose: 'mfa' | 'mfa_enroll' | '2fa',
  ) {
    return this.jwt.signAsync(
      { sub: userId, purpose, mfa: true },
      { expiresIn: '5m' },
    );
  }

  private async verifyMfaTempToken(
    tempToken: string,
    allowed: Array<'mfa' | 'mfa_enroll' | '2fa'> = ['mfa', '2fa', 'mfa_enroll'],
  ): Promise<{ userId: string; purpose: string }> {
    let payload: { sub?: string; purpose?: string; mfa?: boolean };
    try {
      payload = await this.jwt.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }
    const purpose = payload.purpose as 'mfa' | 'mfa_enroll' | '2fa' | undefined;
    if (!payload?.sub || !purpose || !allowed.includes(purpose)) {
      throw new UnauthorizedException('Invalid MFA token purpose');
    }
    return { userId: payload.sub, purpose };
  }

  private async finalizeLogin(
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      shopId: string | null;
      phone?: string | null;
      twoFactorEnabled?: boolean;
      emailVerifiedAt?: Date | null;
    },
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit('LOGIN_SUCCESS', {
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      ip: meta?.ip,
    });
    this.slog.info('Login success', {
      userId: user.id,
      shopId: user.shopId || undefined,
      status: 'ok',
    });
    return this.issueTokens(user, meta);
  }

  /**
   * Complete MFA after password step: verify TOTP + issue access/refresh.
   */
  async verifyMfa(
    tempToken: string,
    code: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const { userId } = await this.verifyMfaTempToken(tempToken, [
      'mfa',
      '2fa',
    ]);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException(
        'TOTP not enabled. Use /auth/mfa/setup and /auth/mfa/enable first',
      );
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      await this.audit('LOGIN_2FA_FAIL', { actorId: user.id, ip: meta?.ip });
      throw new UnauthorizedException('Invalid TOTP code');
    }
    return this.finalizeLogin(user, meta);
  }

  /**
   * MFA enrollment setup using short-lived temp token (admin mandatory MFA).
   */
  async setupTotpWithTemp(tempToken: string) {
    const { userId } = await this.verifyMfaTempToken(tempToken, [
      'mfa_enroll',
      'mfa',
      '2fa',
    ]);
    return this.setup2fa(userId);
  }

  async enableTotpWithTemp(tempToken: string, code: string) {
    const { userId } = await this.verifyMfaTempToken(tempToken, [
      'mfa_enroll',
      'mfa',
      '2fa',
    ]);
    return this.enable2fa(userId, { code });
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await this.revokeToken(refreshToken);
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true, success: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const hash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: hash,
        emailVerifyExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Invalid or expired token');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpires: null,
        status:
          user.status === UserStatus.PENDING_VERIFICATION
            ? UserStatus.ACTIVE
            : user.status,
      },
    });
    await this.audit('EMAIL_VERIFIED', {
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
    });
    return { ok: true, message: 'Email verified' };
  }

  async requestPasswordReset(dto: PasswordResetRequestDto, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always ok (no user enumeration)
    if (!user) {
      return { ok: true, message: 'If the email exists, a reset link was sent' };
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashToken(token),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.audit('PASSWORD_RESET_REQUEST', {
      actorId: user.id,
      ip,
    });
    await this.notifications.sendPasswordReset(email, token);
    return {
      ok: true,
      message: 'If the email exists, a reset link was sent',
      // Dev only
      resetToken: this.isProd() ? undefined : token,
    };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    const hash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Invalid or expired token');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit('PASSWORD_RESET_DONE', { actorId: user.id });
    return { ok: true, message: 'Password updated' };
  }

  async setup2fa(userId: string) {
    const secret = generateTotpSecret();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
        totpVerifiedAt: null,
      },
    });
    const otpauthUrl = totpOtpauthUrl(secret, user.email);
    let qr: string | undefined;
    try {
      // lazy require so unit tests work without native issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const QRCode = require('qrcode') as {
        toDataURL: (text: string) => Promise<string>;
      };
      qr = await QRCode.toDataURL(otpauthUrl);
    } catch {
      qr = undefined;
    }
    return {
      secret,
      otpauthUrl,
      qr,
      totpSecret: secret,
      message:
        'Scan QR / enter secret in authenticator, then POST /auth/2fa/enable or /auth/mfa/enable with code',
    };
  }

  async enable2fa(userId: string, dto: Enable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Call /auth/2fa/setup first');
    }
    if (!verifyTotp(user.twoFactorSecret, dto.code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        totpVerifiedAt: new Date(),
      },
    });
    await this.audit('2FA_ENABLED', { actorId: userId });
    return {
      ok: true,
      enabled: true,
      twoFactorEnabled: true,
      totpEnabled: true,
      message: 'TOTP enabled. Complete login via POST /auth/mfa/verify or login with totpCode',
    };
  }

  async disable2fa(userId: string, dto: Enable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Admins cannot disable MFA (Stage 6 mandatory)
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'MFA is mandatory for ADMIN / SUPER_ADMIN and cannot be disabled',
      );
    }
    if (
      user.twoFactorEnabled &&
      (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, dto.code))
    ) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        totpVerifiedAt: null,
      },
    });
    await this.audit('2FA_DISABLED', { actorId: userId });
    return { ok: true, twoFactorEnabled: false, totpEnabled: false };
  }

  async validateTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return false;
    return verifyTotp(user.twoFactorSecret, code);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        company: true,
        role: true,
        shopId: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        twoFactorEnabled: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            verified: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; phone?: string; company?: string },
  ) {
    const data: {
      name?: string;
      phone?: string | null;
      company?: string | null;
    } = {};

    if (dto.name !== undefined && dto.name !== null) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('Name cannot be empty');
      data.name = name;
    }

    if (dto.phone !== undefined) {
      const phone =
        dto.phone == null || dto.phone === ''
          ? null
          : String(dto.phone).trim() || null;
      if (phone) {
        const taken = await this.prisma.user.findFirst({
          where: { phone, NOT: { id: userId } },
          select: { id: true },
        });
        if (taken) throw new ConflictException('Phone already in use');
      }
      data.phone = phone;
    }

    if (dto.company !== undefined) {
      data.company =
        dto.company == null || dto.company === ''
          ? null
          : String(dto.company).trim() || null;
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('No profile fields to update');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    await this.audit('PROFILE_UPDATE', {
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      meta: data,
    });

    return this.me(userId);
  }
}
