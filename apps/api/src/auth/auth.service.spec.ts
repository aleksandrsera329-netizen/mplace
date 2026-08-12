import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
    signAsync: jest.fn().mockResolvedValue('mock-access-token'),
    verify: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'REFRESH_TOKEN_DAYS') return '30';
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  };

  const mockNotifications = {
    sendEmailVerification: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordReset: jest.fn().mockResolvedValue({ success: true }),
    sendKycStatus: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationService, useValue: mockNotifications },
        {
          provide: StructuredLogger,
          useValue: {
            child: () => ({
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
              timed: jest.fn((_m, _f, fn) => fn()),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockJwtService.signAsync.mockResolvedValue('mock-access-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = {
      email: 'customer@demo.com',
      password: '123456',
    };

    let mockUser: {
      id: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      status: UserStatus;
      name: string;
      shopId: string | null;
      phone: string | null;
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      twoFactorEnabled: boolean;
      twoFactorSecret: string | null;
      emailVerifiedAt: Date | null;
    };

    beforeEach(async () => {
      mockUser = {
        id: 'user-1',
        email: 'customer@demo.com',
        passwordHash: await bcrypt.hash('123456', 10),
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        name: 'Test User',
        shopId: null,
        phone: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        emailVerifiedAt: new Date(),
      };
    });

    it('should login successfully with correct credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        familyId: 'fam-1',
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect((result as { user: { email: string } }).user.email).toBe(
        loginDto.email,
      );
      expect(mockJwtService.signAsync).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            familyId: expect.any(String),
            tokenHash: expect.any(String),
          }),
        }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await expect(
        service.login({ ...loginDto, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user is suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if email and phone missing', async () => {
      await expect(
        service.login({ password: '123456' } as { password: string }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('me', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'customer@demo.com',
        name: 'Test',
        role: UserRole.CUSTOMER,
        company: null,
        phone: null,
        shopId: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        twoFactorEnabled: false,
        shop: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me('user-1');
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('should throw UnauthorizedException if user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.me('missing')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh rotation + reuse detection', () => {
    const mockUser = {
      id: 'user-1',
      email: 'customer@demo.com',
      name: 'Test',
      role: UserRole.CUSTOMER,
      shopId: null,
      status: UserStatus.ACTIVE,
      phone: null,
      twoFactorEnabled: false,
      emailVerifiedAt: new Date(),
      passwordHash: 'x',
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorSecret: null,
    };

    it('should rotate refresh token in the same family', async () => {
      const oldHash = require('crypto')
        .createHash('sha256')
        .update('old-refresh-raw')
        .digest('hex');

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        userId: 'user-1',
        familyId: 'family-abc',
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        replacedBy: null,
        user: mockUser,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'rt-new',
        familyId: 'family-abc',
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});

      const result = await service.refresh('old-refresh-raw');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe('old-refresh-raw');
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: 'family-abc',
            userId: 'user-1',
          }),
        }),
      );
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-old' },
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
            replacedBy: 'rt-new',
          }),
        }),
      );
    });

    it('should revoke entire family on refresh token reuse', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        userId: 'user-1',
        familyId: 'family-xyz',
        tokenHash: 'h',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // already rotated
        replacedBy: 'rt-new',
        user: mockUser,
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.refresh('stolen-old-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh('stolen-old-token')).rejects.toThrow(
        /reuse detected/i,
      );

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-xyz', revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('should reject unknown refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('nope')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject expired refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-exp',
        userId: 'user-1',
        familyId: 'family-exp',
        tokenHash: 'h',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        user: mockUser,
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});

      await expect(service.refresh('expired-raw')).rejects.toThrow(
        /expired/i,
      );
    });
  });

  describe('logout', () => {
    it('should revoke the presented refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.logout('some-refresh');
      expect(result.success).toBe(true);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('admin mandatory MFA (Stage 6)', () => {
    it('should require MFA enrollment for admin without TOTP', async () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@demo.com',
        passwordHash: await bcrypt.hash('123456', 10),
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        name: 'Admin',
        shopId: null,
        phone: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        emailVerifiedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockJwtService.signAsync.mockResolvedValue('temp-mfa-token');

      const result = await service.login({
        email: 'admin@demo.com',
        password: '123456',
      });

      expect(result).toMatchObject({
        mfaRequired: true,
        mfaEnrollmentRequired: true,
        tempToken: 'temp-mfa-token',
      });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('should require MFA code when admin has TOTP enabled', async () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@demo.com',
        passwordHash: await bcrypt.hash('123456', 10),
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        name: 'Admin',
        shopId: null,
        phone: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        emailVerifiedAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockJwtService.signAsync.mockResolvedValue('temp-mfa');

      const result = await service.login({
        email: 'admin@demo.com',
        password: '123456',
      });

      expect(result).toMatchObject({
        mfaRequired: true,
        requires2fa: true,
        tempToken: 'temp-mfa',
      });
    });
  });

  describe('updateProfile', () => {
    it('should update name, phone and company', async () => {
      const updatedProfile = {
        id: 'user-1',
        email: 'customer@demo.com',
        name: 'New Name',
        phone: '+79001112233',
        company: 'Oil Corp',
        role: UserRole.CUSTOMER,
        shopId: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        twoFactorEnabled: false,
        shop: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(null); // phone not taken
      mockPrisma.user.update.mockResolvedValue(updatedProfile);
      // updateProfile ends with me()
      mockPrisma.user.findUnique.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('user-1', {
        name: 'New Name',
        phone: '+79001112233',
        company: 'Oil Corp',
      });

      expect(result.name).toBe('New Name');
      expect(result.company).toBe('Oil Corp');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            name: 'New Name',
            phone: '+79001112233',
            company: 'Oil Corp',
          }),
        }),
      );
    });

    it('should throw BadRequestException if no fields', async () => {
      await expect(service.updateProfile('user-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
