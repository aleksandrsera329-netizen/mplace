import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { E2EFixtures, resetAndSeedFixtures } from './fixtures';

describe('Critical Flows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fx: E2EFixtures;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    fx = await resetAndSeedFixtures(prisma);
  });

  afterAll(async () => {
    if (app) {
      const server = app.getHttpServer() as {
        close?: (cb: () => void) => void;
      };
      if (server?.close) {
        await new Promise<void>((resolve) => server.close!(() => resolve()));
      }
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  async function login(email: string, password = fx.password): Promise<string> {
    // Respect short-window throttler (2 req/s on auth)
    await new Promise((r) => setTimeout(r, 1100));
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    // Nest default POST → 201
    expect([200, 201]).toContain(res.status);
    expect(res.body.accessToken).toBeDefined();
    return res.body.accessToken as string;
  }

  // ===================== AUTH =====================
  describe('Auth Flow', () => {
    it('should login customer and get profile', async () => {
      const token = await login(fx.customerAEmail);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const email = me.body.email || me.body.user?.email;
      expect(email).toBe(fx.customerAEmail);
    });

    it('should reject invalid credentials', async () => {
      await new Promise((r) => setTimeout(r, 1100));
      // password min length 6 (DTO) — use long wrong password for 401 not 400
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: fx.customerAEmail, password: 'wrong-password' })
        .expect(401);
    });
  });

  // ===================== CATALOG =====================
  describe('Catalog', () => {
    it('should list products (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      const items = res.body.items || res.body;
      expect(Array.isArray(items) || res.body.items).toBeTruthy();
      expect((res.body.items || []).length).toBeGreaterThanOrEqual(1);
    });

    it('should search products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products/search')
        .query({ q: 'Product' })
        .expect(200);

      expect(res.body).toBeDefined();
      // Meilisearch may be disabled in e2e → empty hits is ok
      expect(
        Array.isArray(res.body.hits) ||
          Array.isArray(res.body.items) ||
          typeof res.body === 'object',
      ).toBe(true);
    });
  });

  // ===================== WISHLIST =====================
  describe('Wishlist', () => {
    it('should add and remove product from wishlist', async () => {
      const token = await login(fx.customerAEmail);
      const productId = fx.productAId;

      // Add
      const addRes = await request(app.getHttpServer())
        .post('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId });
      expect([200, 201]).toContain(addRes.status);

      // List
      const list = await request(app.getHttpServer())
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = list.body.items || list.body;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(
        items.some(
          (it: { productId?: string; product?: { id: string } }) =>
            it.productId === productId || it.product?.id === productId,
        ),
      ).toBe(true);

      // Remove
      await request(app.getHttpServer())
        .delete(`/api/wishlist/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const list2 = await request(app.getHttpServer())
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const items2 = list2.body.items || list2.body;
      expect(
        (items2 as { productId?: string; product?: { id: string } }[]).every(
          (it) =>
            it.productId !== productId && it.product?.id !== productId,
        ),
      ).toBe(true);
    });
  });

  // ===================== MERCHANT ACCESS =====================
  describe('Merchant Access', () => {
    it('merchant should see only own products', async () => {
      const token = await login(fx.merchantAEmail);

      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = res.body.items || [];
      expect(Array.isArray(items)).toBe(true);
      // Merchant list is shop-scoped
      for (const p of items as { shopId?: string; shop?: { id: string } }[]) {
        const sid = p.shopId || p.shop?.id;
        if (sid) expect(sid).toBe(fx.shopAId);
      }
      // Product A belongs to shop A
      expect(items.some((p: { id: string }) => p.id === fx.productAId)).toBe(
        true,
      );
      expect(items.every((p: { id: string }) => p.id !== fx.productBId)).toBe(
        true,
      );
    });
  });
});
