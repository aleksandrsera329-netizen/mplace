import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  PERMISSIONS_POLICY,
  buildCorsOptions,
  buildHelmetOptions,
  resolveCorsOrigins,
} from './common/security/security-headers';
import { requestIdMiddleware } from './common/observability/request-id.middleware';
import { initSentry } from './sentry';

async function bootstrap() {
  await initSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true, // Stripe webhooks
  });

  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  // Trust reverse proxy (nginx) so req.secure / HSTS work correctly
  app.set('trust proxy', 1);

  // Stage 26: requestId + correlationId (headers + AsyncLocalStorage)
  // Must run early so all downstream logs/handlers see context
  app.use(requestIdMiddleware);

  const nodeEnv = config.get<string>('NODE_ENV') || process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';

  // Stage 22: security headers via helmet
  app.use(
    helmet(
      buildHelmetOptions({
        enableSwagger: true,
        isProduction,
      }),
    ),
  );

  // Permissions-Policy (not fully covered by all helmet versions)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });

  // Stage 5: HttpOnly refreshToken cookie
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Stage 22: CORS allowlist only — never origin: '*' with credentials
  const corsOrigins = resolveCorsOrigins(
    config.get<string>('CORS_ORIGINS'),
    nodeEnv,
  );
  if (config.get<string>('CORS_ORIGINS')?.includes('*')) {
    logger.warn(
      'CORS_ORIGINS contains "*" — ignored; using allowlist (credentials require explicit origins)',
    );
  }
  const cors = buildCorsOptions(corsOrigins);
  // Expose observability headers to browsers
  cors.exposedHeaders = [
    ...((cors.exposedHeaders as string[]) || []),
    'X-Request-Id',
    'X-Correlation-Id',
  ];
  app.enableCors(cors);
  logger.log(`CORS allowlist: ${corsOrigins.join(', ')}`);

  // ===== SWAGGER =====
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mplace API')
    .setDescription('Multi-vendor B2B Marketplace API (Oil & Gas)')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Session-Key',
        in: 'header',
      },
      'Session-Key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Order-Access-Token',
        in: 'header',
      },
      'Order-Access-Token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Critical env already validated by ConfigModule.validate (env.validation.ts).
  // Keep a defensive check for misconfigured non-validated boots.
  const dbUrl = config.get<string>('DATABASE_URL');
  const jwt = config.get<string>('JWT_SECRET');
  if (!dbUrl || !jwt) {
    logger.error('Missing required env: DATABASE_URL and/or JWT_SECRET');
    process.exit(1);
  }

  // Stage 2: block public static access to KYC / private storage prefixes
  // (even if monorepo root is served as static frontend)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = req.path || '';
    if (
      p.startsWith('/uploads/kyc') ||
      p.startsWith('/uploads/private') ||
      p.startsWith('/private/kyc')
    ) {
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }
    next();
  });

  // Production / Docker: serve storefront from FRONTEND_DIR
  const serveFrontend =
    config.get<string>('SERVE_FRONTEND') === 'true' ||
    !!config.get<string>('FRONTEND_DIR');
  const frontendDir =
    config.get<string>('FRONTEND_DIR') ||
    join(__dirname, '..', '..', '..', '..');

  if (serveFrontend && existsSync(frontendDir)) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const m = req.path.match(/^\/product\/([^/]+)\/?$/);
      if (!m) return next();
      const file = join(frontendDir, 'product.html');
      if (!existsSync(file)) return next();
      res.type('html').send(readFileSync(file, 'utf8'));
    });

    app.useStaticAssets(frontendDir, {
      index: ['index.html'],
      fallthrough: true,
    });
    logger.log(`frontend static: ${frontendDir}`);
  }

  const port = Number(config.get<string | number>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`API running on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger: http://localhost:${port}/api/docs`);
  logger.log(
    `payments: provider=${config.get('PAYMENT_PROVIDER') || 'dev'}`,
  );
}

void bootstrap();
