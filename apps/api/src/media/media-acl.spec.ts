import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MediaVisibility, UserRole } from '@prisma/client';
import { FileSecurityService } from '../common/upload/file-security.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MediaService } from './media.service';

/**
 * Stage 25 — Media ACL: cross-owner delete/view → 403.
 */
describe('Media ACL (Stage 25)', () => {
  let service: MediaService;

  const mockPrisma = {
    mediaAsset: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorage = {
    deleteImage: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('/signed'),
    toPublicUrl: jest.fn().mockReturnValue(null),
    isPrivateKey: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        {
          provide: FileSecurityService,
          useValue: {
            assertSafe: jest.fn(),
            applySafeMeta: jest.fn(),
          },
        },
      ],
    }).compile();
    service = mod.get(MediaService);
    jest.clearAllMocks();
  });

  const privateMedia = {
    id: 'media-1',
    ownerId: 'user-A',
    shopId: 'shop-A',
    storageKey: 'private/x.webp',
    visibility: MediaVisibility.PRIVATE,
    entityType: 'product',
    entityId: 'p1',
  };

  it('cross-owner delete → 403', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(privateMedia);
    await expect(
      service.delete('media-1', {
        sub: 'user-B',
        role: UserRole.CUSTOMER,
        shopId: null,
        email: 'b@t.com',
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('owner can delete', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(privateMedia);
    mockPrisma.mediaAsset.delete.mockResolvedValue({});
    const r = await service.delete('media-1', {
      sub: 'user-A',
      role: UserRole.CUSTOMER,
      shopId: null,
      email: 'a@t.com',
    } as never);
    expect(r.success).toBe(true);
    expect(mockPrisma.mediaAsset.delete).toHaveBeenCalled();
  });

  it('cross-owner private download/view → 403', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(privateMedia);
    await expect(
      service.findOne('media-1', {
        sub: 'user-B',
        role: UserRole.MERCHANT,
        shopId: 'shop-B',
        email: 'b@t.com',
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('unauthenticated private media → 403', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(privateMedia);
    await expect(service.findOne('media-1', undefined)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('admin can view private media', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(privateMedia);
    const r = await service.findOne('media-1', {
      sub: 'admin-1',
      role: UserRole.ADMIN,
      shopId: null,
      email: 'a@t.com',
    } as never);
    expect(r).toBeTruthy();
  });

  it('missing media → 404', async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue(null);
    await expect(
      service.delete('x', {
        sub: 'u',
        role: UserRole.ADMIN,
        shopId: null,
        email: 'a@t.com',
      } as never),
    ).rejects.toThrow(NotFoundException);
  });
});
