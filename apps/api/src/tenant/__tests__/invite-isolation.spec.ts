import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInviteCommand } from '../commands/create-invite.command';
import { CreateInviteHandler } from '../commands/create-invite.handler';

describe('Invite isolation', () => {
  let handler: CreateInviteHandler;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let outbox: { addToOutbox: jest.Mock };

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const userA = 'user-a';

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === tenantA || where.id === tenantB) {
            return Promise.resolve({
              id: where.id,
              name: where.id === tenantA ? 'A' : 'B',
            });
          }
          return Promise.resolve(null);
        }),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    outbox = { addToOutbox: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInviteHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(CreateInviteHandler);
  });

  it('creates invite only inside own tenant', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: userA,
        role: UserRole.ADMIN,
        tenantId: tenantA,
      })
      // existing user by email
      .mockResolvedValueOnce(null);

    const created = {
      id: 'inv-1',
      tenantId: tenantA,
      email: 'new@test.com',
      role: UserRole.CUSTOMER,
      token: 'tok',
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        tenantInvite: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
          create: jest.fn().mockResolvedValue(created),
        },
      };
      return cb(tx);
    });

    const invite = await handler.execute(
      new CreateInviteCommand(tenantA, 'new@test.com', 'BUYER', userA),
    );

    expect(invite.tenantId).toBe(tenantA);
    expect(outbox.addToOutbox).toHaveBeenCalledWith(
      expect.anything(),
      'TenantInviteCreatedEvent',
      expect.objectContaining({
        tenantId: tenantA,
        email: 'new@test.com',
      }),
    );
  });

  it('cannot create invite for another tenant', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: userA,
      role: UserRole.ADMIN,
      tenantId: tenantA,
    });

    await expect(
      handler.execute(
        new CreateInviteCommand(tenantB, 'hacker@test.com', 'BUYER', userA),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN can invite into any tenant', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'super-1',
        role: UserRole.SUPER_ADMIN,
        tenantId: null,
      })
      .mockResolvedValueOnce(null);

    const created = {
      id: 'inv-2',
      tenantId: tenantB,
      email: 'x@test.com',
      role: UserRole.CUSTOMER,
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        tenantInvite: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
          create: jest.fn().mockResolvedValue(created),
        },
      };
      return cb(tx);
    });

    const invite = await handler.execute(
      new CreateInviteCommand(tenantB, 'x@test.com', 'BUYER', 'super-1'),
    );
    expect(invite.tenantId).toBe(tenantB);
  });
});
