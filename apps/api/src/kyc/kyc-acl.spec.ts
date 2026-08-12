import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { FileSecurityService } from '../common/upload/file-security.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { KycService } from './kyc.service';

/**
 * Stage 25 — KYC ACL matrix: cross-shop 403, admin OK.
 */
describe('KYC ACL (Stage 25)', () => {
  let service: KycService;

  const mockPrisma = {
    kycDocument: {
      findUnique: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockStorage = {
    getSignedUrl: jest.fn().mockResolvedValue('/api/media/signed?k=1'),
    extractKeyFromUrl: jest.fn((x: string) => x),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        {
          provide: NotificationService,
          useValue: { sendKycStatus: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { notify: jest.fn() },
        },
        {
          provide: FileSecurityService,
          useValue: {
            assertSafe: jest.fn(),
            applySafeMeta: jest.fn(),
          },
        },
        {
          provide: StructuredLogger,
          useValue: {
            child: () => ({
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            }),
          },
        },
      ],
    }).compile();
    service = mod.get(KycService);
    jest.clearAllMocks();
  });

  const doc = {
    id: 'kyc-1',
    shopId: 'shop-A',
    uploadedById: 'merchant-A',
    mediaAssetId: 'm1',
    mediaAsset: { storageKey: 'private/kyc/shop-A/x.pdf' },
    shop: { id: 'shop-A', name: 'A' },
  };

  it('cross-shop merchant cannot download → 403', async () => {
    mockPrisma.kycDocument.findUnique.mockResolvedValue(doc);
    await expect(
      service.getDownloadUrl('kyc-1', {
        sub: 'merchant-B',
        role: UserRole.MERCHANT,
        shopId: 'shop-B',
        email: 'b@t.com',
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(mockStorage.getSignedUrl).not.toHaveBeenCalled();
  });

  it('admin can download → signed URL', async () => {
    mockPrisma.kycDocument.findUnique.mockResolvedValue(doc);
    const r = await service.getDownloadUrl('kyc-1', {
      sub: 'admin-1',
      role: UserRole.ADMIN,
      shopId: null,
      email: 'a@t.com',
    } as never);
    expect(r).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        expiresIn: 180,
      }),
    );
    expect(mockStorage.getSignedUrl).toHaveBeenCalled();
  });

  it('owning merchant can download', async () => {
    mockPrisma.kycDocument.findUnique.mockResolvedValue(doc);
    const r = await service.getDownloadUrl('kyc-1', {
      sub: 'merchant-A',
      role: UserRole.MERCHANT,
      shopId: 'shop-A',
      email: 'a@t.com',
    } as never);
    expect(r.url).toBeTruthy();
  });

  it('missing document → 404', async () => {
    mockPrisma.kycDocument.findUnique.mockResolvedValue(null);
    await expect(
      service.getDownloadUrl('missing', {
        sub: 'admin-1',
        role: UserRole.ADMIN,
        shopId: null,
        email: 'a@t.com',
      } as never),
    ).rejects.toThrow(NotFoundException);
  });
});
