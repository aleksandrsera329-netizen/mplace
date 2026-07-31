import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(
    helmet({
      contentSecurityPolicy: false, // allow Stripe.js + inline for storefront
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const originsRaw = config.get<string>('CORS_ORIGINS');
  const origins = originsRaw
    ? originsRaw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'https://mplace-vu4o.onrender.com',
      ];

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Key',
      'X-Order-Access-Token',
    ],
  });

  // Soft check critical env (warn only — Docker generates JWT_SECRET)
  if (!config.get('JWT_SECRET') && !process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET is not set — using insecure default for local only');
  }

  // Production / Docker: serve storefront from FRONTEND_DIR
  const serveFrontend =
    config.get<string>('SERVE_FRONTEND') === 'true' ||
    !!config.get<string>('FRONTEND_DIR');
  const frontendDir =
    config.get<string>('FRONTEND_DIR') ||
    join(__dirname, '..', '..', '..', '..'); // monorepo root when running dist/src

  if (serveFrontend && existsSync(frontendDir)) {
    // Pretty URLs: /product/:slug → product.html (client reads path or ?id=)
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const m = req.path.match(/^\/product\/([^/]+)\/?$/);
      if (!m) return next();
      const file = join(frontendDir, 'product.html');
      if (!existsSync(file)) return next();
      res.type('html').send(readFileSync(file, 'utf8'));
    });

    // Serve storefront + admin/merchant static files (same origin as /api)
    app.useStaticAssets(frontendDir, {
      index: ['index.html'],
      fallthrough: true,
    });
    // eslint-disable-next-line no-console
    console.log(`frontend static: ${frontendDir}`);
  }

  const port = Number(config.get('PORT') || process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`mplace-api listening on 0.0.0.0:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(
    `payments: provider=${config.get('PAYMENT_PROVIDER') || 'dev'}`,
  );
}

void bootstrap();
