import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { E2EFixtures, resetAndSeedFixtures } from './fixtures';

describe('Security (e2e)', () => {
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

  afterAll(async () => {
    if (app) {
      const server = app.getHttpServer() as { close?: (cb: () => void) => void };
      if (server?.close) {
        await new Promise<void>((resolve) => server.close!(() => resolve()));
      }
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    fx = await resetAndSeedFixtures(prisma);
  });

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    expect([200, 201]).toContain(res.status);
    expect(res.body.accessToken).toBeDefined();
    return res.body.accessToken as string;
  }

  it('GET /api/health', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/status', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/status');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('mplace-api');
    expect(res.body.database).toBe('up');
  });


  it('rejects POST /api/orders/:id/pay (removed)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/any-id/pay')
      .send({})
      .expect(404);
  });

  it('guest token in header allows order access; query token does not; customer B cannot read', async () => {
    const session = `e2e_sess_${Date.now()}`;

    const add = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('X-Session-Key', session)
      .send({ productId: fx.productAId, quantity: 1 });
    expect([200, 201]).toContain(add.status);

    const checkout = await request(app.getHttpServer())
      .post('/api/checkout')
      .set('X-Session-Key', session)
      .send({ customerName: 'Guest', customerEmail: 'guest-e2e@example.com' });
    expect([200, 201]).toContain(checkout.status);
    expect(checkout.body.orders?.length).toBeGreaterThan(0);

    const order = checkout.body.orders[0];
    expect(order.paymentToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/orders/' + order.id)
      .expect(403);

    await request(app.getHttpServer())
      .get(
        '/api/orders/' +
          order.id +
          '?paymentToken=' +
          encodeURIComponent(order.paymentToken),
      )
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/orders/' + order.id)
      .set('X-Order-Access-Token', order.paymentToken)
      .expect(200);

    const tokenB = await login(fx.customerBEmail, fx.password);
    await request(app.getHttpServer())
      .get('/api/orders/' + order.id)
      .set('Authorization', 'Bearer ' + tokenB)
      .expect(403);
  });

  it('merchant B does not see merchant A shop orders', async () => {
    const session = `e2e_sess_m_${Date.now()}`;
    const add = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('X-Session-Key', session)
      .send({ productId: fx.productAId, quantity: 1 });
    expect([200, 201]).toContain(add.status);
    expect(add.body.itemCount).toBeGreaterThan(0);

    const checkout = await request(app.getHttpServer())
      .post('/api/checkout')
      .set('X-Session-Key', session)
      .send({ customerName: 'Guest B', customerEmail: 'guest-b@example.com' });
    if (![200, 201].includes(checkout.status)) {
      throw new Error(`checkout failed ${checkout.status}: ${JSON.stringify(checkout.body)}`);
    }
    expect(checkout.body.orders?.length).toBeGreaterThan(0);

    // confirm payment so order is real
    const order = checkout.body.orders[0];
    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/payment-intent`)
      .set('X-Order-Access-Token', order.paymentToken)
      .send({ paymentToken: order.paymentToken });

    await request(app.getHttpServer())
      .post('/api/payments/dev-confirm')
      .set('X-Dev-Payment-Secret', 'e2e_dev_secret')
      .set('X-Order-Access-Token', order.paymentToken)
      .send({ orderId: order.id, paymentToken: order.paymentToken })
      .expect((r) => expect([200, 201]).toContain(r.status));

    const tokenA = await login(fx.merchantAEmail, fx.password);
    const tokenB = await login(fx.merchantBEmail, fx.password);

    const listA = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .expect(200);
    const itemsA: { id: string }[] = listA.body.items || listA.body;
    expect(itemsA.some((o) => o.id === order.id)).toBe(true);

    const listB = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', 'Bearer ' + tokenB)
      .expect(200);
    const itemsB: { id: string }[] = listB.body.items || listB.body;
    expect(itemsB.some((o) => o.id === order.id)).toBe(false);

    await request(app.getHttpServer())
      .get('/api/orders/' + order.id)
      .set('Authorization', 'Bearer ' + tokenB)
      .expect(403);
  });

  it('webhook/dev-confirm is idempotent and stock does not go negative', async () => {
    const before = await prisma.product.findUniqueOrThrow({
      where: { id: fx.productAId },
    });
    expect(before.stock).toBe(5);

    const session = `e2e_stock_${Date.now()}`;
    const add = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('X-Session-Key', session)
      .send({ productId: fx.productAId, quantity: 2 });
    expect([200, 201]).toContain(add.status);

    const checkout = await request(app.getHttpServer())
      .post('/api/checkout')
      .set('X-Session-Key', session)
      .send({ customerName: 'Stock Tester', customerEmail: 'stock@example.com' });
    if (![200, 201].includes(checkout.status)) {
      throw new Error(`checkout failed ${checkout.status}: ${JSON.stringify(checkout.body)}`);
    }
    expect(checkout.body.orders?.length).toBeGreaterThan(0);
    const order = checkout.body.orders[0];

    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/payment-intent`)
      .set('X-Order-Access-Token', order.paymentToken)
      .send({ paymentToken: order.paymentToken });

    const confirmBody = {
      orderId: order.id,
      paymentToken: order.paymentToken,
      idempotencyKey: `idem_${order.id}`,
    };
    const headers = {
      'X-Dev-Payment-Secret': 'e2e_dev_secret',
      'X-Order-Access-Token': order.paymentToken,
    };

    const c1 = await request(app.getHttpServer())
      .post('/api/payments/dev-confirm')
      .set(headers)
      .send(confirmBody);
    expect([200, 201]).toContain(c1.status);
    expect(c1.body.status).toBe('PAID');

    const c2 = await request(app.getHttpServer())
      .post('/api/payments/dev-confirm')
      .set(headers)
      .send(confirmBody);
    expect([200, 201]).toContain(c2.status);
    expect(c2.body.status).toBe('PAID');

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: fx.productAId },
    });
    // stock decremented once: 5 - 2 = 3
    expect(after.stock).toBe(3);
    expect(after.stock).toBeGreaterThanOrEqual(0);

    const payments = await prisma.payment.findMany({
      where: { orderId: order.id, status: 'SUCCEEDED' },
    });
    // one successful payment path (idempotent key reuses same payment)
    expect(payments.length).toBeGreaterThanOrEqual(1);
  });

  it('cannot add more to cart than stock', async () => {
    const session = `e2e_over_${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('X-Session-Key', session)
      .send({ productId: fx.productAId, quantity: 99 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('dev-confirm rejects wrong secret', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments/dev-confirm')
      .set('X-Dev-Payment-Secret', 'wrong-secret')
      .send({ orderId: 'x', paymentToken: 'y' });
    expect(res.status).toBe(400);
  });
});
