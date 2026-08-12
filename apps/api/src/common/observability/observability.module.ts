import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextInterceptor } from './request-context.interceptor';
import { StructuredLogger } from './structured-logger.service';

@Global()
@Module({
  providers: [
    StructuredLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [StructuredLogger],
})
export class ObservabilityModule {}
