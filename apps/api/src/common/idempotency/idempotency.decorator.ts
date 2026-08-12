import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    return (
      request.headers['idempotency-key'] ||
      request.headers['x-idempotency-key']
    );
  },
);
