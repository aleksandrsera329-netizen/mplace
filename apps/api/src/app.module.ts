import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BuyerModule } from './buyer/buyer.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { KycModule } from './kyc/kyc.module';
import { NotificationModule } from './notification/notification.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RfqModule } from './rfq/rfq.module';
import { ShopsModule } from './shops/shops.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Prefer production overrides, then local .env (apps/api and monorepo root)
      envFilePath: [
        '.env.production',
        '../../.env.production',
        '.env',
        '../../.env',
      ],
      // validationSchema: Joi — later (Этап 1)
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // LoggerModule boots before ConfigService injection here — env is fine
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        autoLogging: true,
        quietReqLogger: true,
      },
    }),
    // Differentiated rate limits (all apply unless overridden per-route)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1s
        limit: 5,
      },
      {
        name: 'medium',
        ttl: 10_000, // 10s
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60_000, // 1 min
        limit: 100,
      },
    ]),
    PrismaModule,
    AuditModule,
    NotificationModule,
    HealthModule,
    AuthModule,
    AdminModule,
    CatalogModule,
    ShopsModule,
    OrdersModule,
    PaymentsModule,
    FinanceModule,
    SupportModule,
    RfqModule,
    BuyerModule,
    KycModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
