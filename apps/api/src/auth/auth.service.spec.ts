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
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
    signAsync: jest.fn().mockResolvedValue('mock-access-token'),
    verify: jest.fn(),
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
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect((result as { user: { email: string } }).user.email).toBe(
        loginDto.email,
      );
      expect(mockJwtService.signAsync).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
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
