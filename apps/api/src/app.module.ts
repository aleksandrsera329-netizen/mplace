import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { GLOBAL_THROTTLE } from './common/throttle/throttle.limits';
import { UploadModule } from './common/upload/upload.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { MetricsModule } from './metrics/metrics.module';
import { randomUUID } from 'crypto';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BuyerModule } from './buyer/buyer.module';
import { MerchantModule } from './merchant/merchant.module';
import { CacheModule } from './cache/cache.module';
import { CatalogModule } from './catalog/catalog.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { KycModule } from './kyc/kyc.module';
import { NotificationModule } from './notification/notification.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RfqModule } from './rfq/rfq.module';
import { SearchModule } from './search/search.module';
import { ShopsModule } from './shops/shops.module';
import { StorageModule } from './storage/storage.module';
import { SupportModule } from './support/support.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { MediaModule } from './media/media.module';
import { EventsModule } from './events/events.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AppCqrsModule } from './common/cqrs/cqrs.module';
import { WebsocketsModule } from './common/websockets/websockets.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { TenantModule } from './tenant/tenant.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { ShippingModule } from './shipping/shipping.module';
import { TaxModule } from './tax/tax.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DocumentsModule } from './documents/documents.module';
import { RefundsModule } from './refunds/refunds.module';
import { TenantIsolationInterceptor } from './common/tenant/tenant-isolation.interceptor';

@Module({
  imports: [
    AppCqrsModule,
    WebsocketsModule,
    OutboxModule,
    IdempotencyModule,
    TenantModule,
    WarehouseModule,
    ShippingModule,
    TaxModule,
    RefundsModule,
    NotificationsModule,
    DocumentsModule,
    EventsModule,
    QueueModule,
    RealtimeModule,
    ConfigModule.forRoot({
      isGlobal: true,
      // Prefer production overrides, then local .env (apps/api and monorepo root)
      envFilePath: [
        '.env.production',
        '../../.env.production',
        '.env',
        '../../.env',
      ],
      // Stage 4: fail-fast secrets in production
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Stage 26: stable req id from middleware / header
        genReqId: (req, _res) => {
          const anyReq = req as {
            id?: string | number;
            headers?: Record<string, unknown>;
            requestId?: string;
          };
          const h = anyReq.headers?.['x-request-id'];
          if (typeof h === 'string' && h.trim()) return h.trim();
          if (anyReq.requestId) return anyReq.requestId;
          if (anyReq.id != null) return String(anyReq.id);
          return randomUUID();
        },
        customProps: (req) => {
          const anyReq = req as {
            requestId?: string;
            correlationId?: string;
            id?: string | number;
            user?: { sub?: string; shopId?: string | null };
          };
          return {
            requestId: anyReq.requestId || (anyReq.id != null ? String(anyReq.id) : undefined),
            correlationId:
              anyReq.correlationId ||
              anyReq.requestId ||
              (anyReq.id != null ? String(anyReq.id) : undefined),
            userId: anyReq.user?.sub,
            shopId: anyReq.user?.shopId || undefined,
          };
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        autoLogging: true,
        quietReqLogger: true,
      },
    }),
    ObservabilityModule,
    MetricsModule,
    // Stage 23: global rate limit + Redis store when REDIS_URL is set
    // skipIf: disable in jest/e2e so suites never hit 429 mid-run
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        return {
          skipIf: () =>
            process.env.NODE_ENV === 'test' ||
            process.env.DISABLE_THROTTLE === '1',
          throttlers: [
            {
              name: GLOBAL_THROTTLE.name,
              ttl: GLOBAL_THROTTLE.ttl,
              limit: GLOBAL_THROTTLE.limit,
            },
          ],
          // X-RateLimit-Limit / Remaining / Reset + Retry-After on 429
          setHeaders: true,
          ...(redisUrl
            ? { storage: new ThrottlerStorageRedisService(redisUrl) }
            : {}),
        };
      },
    }),
    PrismaModule,
    UploadModule,
    CacheModule,
    SearchModule,
    StorageModule,
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
    MerchantModule,
    WishlistModule,
    MediaModule,
    KycModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantIsolationInterceptor,
    },
  ],
})
export class AppModule {}
