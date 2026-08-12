import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

/**
 * Stage 25 — Auth security matrix: lockout + password reset.
 */
describe('Auth security matrix (Stage 25)', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };

  const mockNotifications = {
    sendPasswordReset: jest.fn().mockResolvedValue({ success: true }),
    sendEmailVerification: jest.fn(),
    sendKycStatus: jest.fn(),
  };

  const slog = {
    child: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test') },
        },
        { provide: NotificationService, useValue: mockNotifications },
        { provide: StructuredLogger, useValue: slog },
      ],
    }).compile();
    service = mod.get(AuthService);
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('locks account after 5 failed password attempts', async () => {
    const passwordHash = await bcrypt.hash('correct-pass', 10);
    let attempts = 4; // next fail is #5 → lock

    mockPrisma.user.findUnique.mockImplementation(async () => ({
      id: 'u1',
      email: 'a@test.local',
      passwordHash,
      name: 'A',
      role: UserRole.CUSTOMER,
      shopId: null,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: attempts,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    }));

    mockPrisma.user.update.mockImplementation(async ({ data }) => {
      if (data.failedLoginAttempts != null) attempts = data.failedLoginAttempts;
      if (data.lockedUntil) {
        return { lockedUntil: data.lockedUntil };
      }
      return {};
    });

    await expect(
      service.login({ email: 'a@test.local', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects login while locked', async () => {
    const passwordHash = await bcrypt.hash('correct-pass', 10);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@test.local',
      passwordHash,
      name: 'A',
      role: UserRole.CUSTOMER,
      shopId: null,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      twoFactorEnabled: false,
    });

    await expect(
      service.login({ email: 'a@test.local', password: 'correct-pass' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('password reset request always returns ok (no enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const r = await service.requestPasswordReset({ email: 'nope@x.com' });
    expect(r.ok).toBe(true);
    expect(mockNotifications.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('password reset confirm updates hash and revokes refresh tokens', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@test.local',
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    // token must match hash lookup path — service hashes dto.token
    const r = await service.confirmPasswordReset({
      token: 'raw-reset-token',
      password: 'NewPass123!',
    });
    expect(r).toEqual(expect.objectContaining({ ok: true }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          passwordResetToken: null,
          failedLoginAttempts: 0,
        }),
      }),
    );
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1' }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });
});
