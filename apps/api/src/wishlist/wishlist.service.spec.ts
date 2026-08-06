import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistService } from './wishlist.service';

describe('WishlistService', () => {
  let service: WishlistService;

  const mockPrisma = {
    wishlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWishlist', () => {
    it('should return wishlist items with product details', async () => {
      const mockItems = [
        {
          id: 'w1',
          productId: 'p1',
          product: { id: 'p1', name: 'Pump', priceCents: 10000 },
        },
      ];

      mockPrisma.wishlistItem.findMany.mockResolvedValue(mockItems);

      const result = await service.getWishlist('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe('Pump');
      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });

    it('should return empty array if no items', async () => {
      mockPrisma.wishlistItem.findMany.mockResolvedValue([]);

      const result = await service.getWishlist('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('addToWishlist', () => {
    it('should add product to wishlist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Pump',
        status: 'ACTIVE',
      });

      mockPrisma.wishlistItem.upsert.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        productId: 'p1',
        product: { id: 'p1', name: 'Pump' },
      });

      const result = await service.addToWishlist('user-1', 'p1');

      expect(result.productId).toBe('p1');
      expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_productId: { userId: 'user-1', productId: 'p1' } },
          create: { userId: 'user-1', productId: 'p1' },
        }),
      );
    });

    it('should throw if productId is missing', async () => {
      await expect(service.addToWishlist('user-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addToWishlist('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeFromWishlist', () => {
    it('should remove product from wishlist', async () => {
      mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeFromWishlist('user-1', 'p1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', productId: 'p1' },
      });
    });
  });
});
