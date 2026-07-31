import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BuyerModule } from './buyer/buyer.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { KycModule } from './kyc/kyc.module';
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
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 60 seconds
        limit: 80, // max requests per IP per window
      },
    ]),
    PrismaModule,
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
