import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserRole } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

describe('PermissionsGuard', () => {
  const prisma = {
    rolePermission: {
      findMany: jest.fn(),
    },
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  let guard: PermissionsGuard;

  const ctx = (user?: { sub: string; role: UserRole }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  beforeEach(() => {
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      prisma as never,
    );
    jest.clearAllMocks();
  });

  it('allows when no permissions required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx({ sub: '1', role: UserRole.CUSTOMER }))).resolves.toBe(
      true,
    );
  });

  it('allows SUPER_ADMIN for any permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.payouts_approve]);
    await expect(
      guard.canActivate(ctx({ sub: '1', role: UserRole.SUPER_ADMIN })),
    ).resolves.toBe(true);
    expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('allows ADMIN with granted permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.kyc_approve]);
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: Permission.kyc_approve },
      { permission: Permission.kyc_read },
    ]);
    await expect(
      guard.canActivate(ctx({ sub: '1', role: UserRole.ADMIN })),
    ).resolves.toBe(true);
  });

  it('forbids ADMIN missing permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.payouts_approve]);
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: Permission.kyc_read },
    ]);
    await expect(
      guard.canActivate(ctx({ sub: '1', role: UserRole.ADMIN })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forbids non-admin roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.users_read]);
    await expect(
      guard.canActivate(ctx({ sub: '1', role: UserRole.MERCHANT })),
    ).rejects.toThrow(ForbiddenException);
  });
});
