import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

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
    : true; // same-origin deploy: reflect request origin

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Production / Docker: serve storefront from FRONTEND_DIR
  const serveFrontend =
    config.get<string>('SERVE_FRONTEND') === 'true' ||
    !!config.get<string>('FRONTEND_DIR');
  const frontendDir =
    config.get<string>('FRONTEND_DIR') ||
    join(__dirname, '..', '..', '..', '..'); // monorepo root when running dist/src

  if (serveFrontend && existsSync(frontendDir)) {
    app.useStaticAssets(frontendDir, {
      index: false,
      fallthrough: true,
    });
    // SPA-ish fallback for admin/merchant deep links
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('*', (req: { path: string }, res: { sendFile: (p: string) => void }, next: () => void) => {
      if (req.path.startsWith('/api')) return next();
      const index = join(frontendDir, 'index.html');
      if (existsSync(index) && (req.path === '/' || !req.path.includes('.'))) {
        return res.sendFile(index);
      }
      return next();
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
