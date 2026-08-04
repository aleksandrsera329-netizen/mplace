import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true, // Stripe webhooks
  });

  const config = app.get(ConfigService);
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI + Stripe.js + storefront
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

  const corsOrigins =
    config
      .get<string>('CORS_ORIGINS')
      ?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) || [
      'http://localhost',
      'http://127.0.0.1',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:8088',
      'http://127.0.0.1:8088',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Key',
      'X-Order-Access-Token',
    ],
  });

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

  // Critical env — only ConfigService (no process.env)
  const dbUrl = config.get<string>('DATABASE_URL');
  if (!dbUrl) {
    logger.error('Missing required env: DATABASE_URL');
    process.exit(1);
  }
  const jwt = config.get<string>('JWT_SECRET');
  if (!jwt) {
    logger.error('Missing required env: JWT_SECRET');
    process.exit(1);
  }

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
