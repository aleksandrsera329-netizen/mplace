import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  async start(
    key: string | undefined,
    endpoint: string,
    userId?: string,
    body?: unknown,
  ): Promise<{ isNew: boolean; existingResponse?: unknown; skipped?: boolean }> {
    if (!key || key.length < 8) {
      // Optional: no key → no idempotency
      return { isNew: true, skipped: true };
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.status === 'COMPLETED' && existing.response != null) {
        return { isNew: false, existingResponse: existing.response };
      }
      if (existing.status === 'PROCESSING') {
        throw new ConflictException(
          'Request with this Idempotency-Key is already processing',
        );
      }
      // FAILED → allow retry by recreating
      await this.prisma.idempotencyKey.delete({ where: { key } }).catch(() => null);
    }

    const requestHash = body
      ? crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')
      : null;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

    await this.prisma.idempotencyKey.create({
      data: {
        key,
        userId: userId ?? null,
        endpoint,
        requestHash,
        status: 'PROCESSING',
        expiresAt,
      },
    });

    return { isNew: true };
  }

  async complete(key: string | undefined, response: unknown) {
    if (!key || key.length < 8) return;
    await this.prisma.idempotencyKey
      .update({
        where: { key },
        data: {
          status: 'COMPLETED',
          response: response as Prisma.InputJsonValue,
        },
      })
      .catch((e) =>
        this.logger.warn(`idempotency complete failed: ${e.message}`),
      );
  }

  async fail(key: string | undefined) {
    if (!key || key.length < 8) return;
    await this.prisma.idempotencyKey
      .update({
        where: { key },
        data: { status: 'FAILED' },
      })
      .catch(() => null);
  }

  async cleanup() {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired idempotency keys`);
    }
  }
}
