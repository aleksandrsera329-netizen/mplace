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
import { createHash, randomBytes } from 'crypto';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
  ) {}

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
    const accessToken = await this.jwt.signAsync(payload);
    const refreshRaw = randomBytes(48).toString('hex');
    const refreshHash = this.hashToken(refreshRaw);
    const days = Number(this.config.get('REFRESH_TOKEN_DAYS') || 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });
    return {
      accessToken,
      refreshToken: refreshRaw,
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m',
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
      throw new UnauthorizedException('Invalid credentials');
    }

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

    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        return {
          requires2fa: true,
          message: 'Enter TOTP code from authenticator app',
          partialToken: await this.jwt.signAsync(
            { sub: user.id, purpose: '2fa' },
            { expiresIn: '5m' },
          ),
        };
      }
      if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, dto.totpCode)) {
        await this.audit('LOGIN_2FA_FAIL', { actorId: user.id, ip: meta?.ip });
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

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
    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }) {
    const hash = this.hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(row.user, meta);
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hash },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
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
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    return {
      secret,
      otpauthUrl: totpOtpauthUrl(secret, user.email),
      message: 'Scan QR / enter secret in authenticator, then POST /auth/2fa/enable with code',
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
      data: { twoFactorEnabled: true },
    });
    await this.audit('2FA_ENABLED', { actorId: userId });
    return { ok: true, twoFactorEnabled: true };
  }

  async disable2fa(userId: string, dto: Enable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (
      user.twoFactorEnabled &&
      (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, dto.code))
    ) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await this.audit('2FA_DISABLED', { actorId: userId });
    return { ok: true, twoFactorEnabled: false };
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
