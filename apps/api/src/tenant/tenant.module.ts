import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantMiddleware } from '../common/tenant/tenant.middleware';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { TenantIsolationInterceptor } from '../common/tenant/tenant-isolation.interceptor';
import { AcceptInviteHandler } from './commands/accept-invite.handler';
import { CreateInviteHandler } from './commands/create-invite.handler';
import { CreateTenantHandler } from './commands/create-tenant.handler';
import { UpdateTenantBrandingHandler } from './commands/update-tenant-branding.handler';
import { TenantInviteCreatedHandler } from './events/tenant-invite-created.handler';
import {
  TenantAdminController,
  TenantPublicController,
} from './tenant.controller';

@Module({
  imports: [CqrsModule],
  controllers: [TenantPublicController, TenantAdminController],
  providers: [
    CreateTenantHandler,
    UpdateTenantBrandingHandler,
    CreateInviteHandler,
    AcceptInviteHandler,
    TenantInviteCreatedHandler,
    TenantMiddleware,
    TenantGuard,
    TenantIsolationInterceptor,
  ],
  exports: [
    CreateTenantHandler,
    UpdateTenantBrandingHandler,
    CreateInviteHandler,
    AcceptInviteHandler,
    TenantGuard,
    TenantMiddleware,
    TenantIsolationInterceptor,
  ],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
