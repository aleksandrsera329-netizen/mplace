import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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

  it('/api/health (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body.info?.database?.status || res.body.details?.database?.status).toBe(
      'up',
    );
  });

  it('/api/health/status (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'mplace-api');
    expect(res.body).toHaveProperty('status');
  });
});

