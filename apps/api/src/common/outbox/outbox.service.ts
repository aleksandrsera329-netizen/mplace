import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderStatusChangedEvent } from '../events/order-status-changed.event';
import { RfqCreatedEvent } from '../events/rfq-created.event';
import { RfqResponseCreatedEvent } from '../events/rfq-response-created.event';
import { RfqResponseAcceptedEvent } from '../events/rfq-response-accepted.event';
import { RfqResponseRejectedEvent } from '../events/rfq-response-rejected.event';
import { RfqClosedEvent } from '../events/rfq-closed.event';
import { TenantInviteCreatedEvent } from '../events/tenant-invite-created.event';
import { TenantInviteAcceptedEvent } from '../events/tenant-invite-accepted.event';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /** Insert within an existing transaction */
  async addToOutbox(
    tx: Tx,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await tx.outbox.create({
      data: {
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }

  /** Insert outside a transaction */
  async enqueue(eventType: string, payload: Record<string, unknown>) {
    await this.prisma.outbox.create({
      data: {
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }

  async processPending(limit = 20) {
    const events = await this.prisma.outbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const record of events) {
      try {
        await this.prisma.outbox.update({
          where: { id: record.id },
          data: { status: 'PROCESSING', attempts: { increment: 1 } },
        });

        const payload = record.payload as Record<string, unknown>;
        const domainEvent = this.rehydrate(record.eventType, payload);
        if (domainEvent) {
          this.eventBus.publish(domainEvent);
        } else {
          this.logger.warn(`Unknown outbox eventType: ${record.eventType}`);
        }

        await this.prisma.outbox.update({
          where: { id: record.id },
          data: {
            status: 'DONE',
            processedAt: new Date(),
            lastError: null,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Outbox failed for ${record.id}: ${message}`);

        const attempts = record.attempts + 1;
        await this.prisma.outbox.update({
          where: { id: record.id },
          data: {
            status: attempts >= 5 ? 'FAILED' : 'PENDING',
            lastError: message.slice(0, 500),
          },
        });
      }
    }

    return events.length;
  }

  private rehydrate(eventType: string, payload: Record<string, unknown>) {
    if (eventType === 'OrderStatusChangedEvent') {
      return new OrderStatusChangedEvent(
        String(payload.orderId),
        String(payload.oldStatus),
        String(payload.newStatus),
        (payload.changedBy as string) ?? null,
      );
    }
    if (eventType === 'OrderCreatedEvent') {
      return new OrderCreatedEvent(
        String(payload.orderId),
        (payload.customerId as string) ?? null,
        Number(payload.totalCents) || 0,
        Array.isArray(payload.shopIds)
          ? (payload.shopIds as string[])
          : [],
        payload.orderNumber as string | undefined,
      );
    }
    if (eventType === 'RfqCreatedEvent') {
      return new RfqCreatedEvent(
        String(payload.rfqId),
        String(payload.buyerId),
        String(payload.title || ''),
        Array.isArray(payload.categoryIds)
          ? (payload.categoryIds as string[])
          : [],
        Array.isArray(payload.shopIds) ? (payload.shopIds as string[]) : [],
        payload.number as string | undefined,
      );
    }
    if (eventType === 'RfqResponseCreatedEvent') {
      return new RfqResponseCreatedEvent(
        String(payload.responseId),
        String(payload.rfqId),
        String(payload.shopId),
        String(payload.merchantId),
        Number(payload.totalCents) || 0,
      );
    }
    if (eventType === 'RfqResponseAcceptedEvent') {
      return new RfqResponseAcceptedEvent(
        String(payload.responseId),
        String(payload.rfqId),
        String(payload.shopId),
        String(payload.buyerId),
        Number(payload.totalCents) || 0,
      );
    }
    if (eventType === 'RfqResponseRejectedEvent') {
      return new RfqResponseRejectedEvent(
        String(payload.responseId),
        String(payload.rfqId),
        String(payload.shopId),
        String(payload.buyerId),
        payload.reason as string | undefined,
      );
    }
    if (eventType === 'RfqClosedEvent') {
      return new RfqClosedEvent(
        String(payload.rfqId),
        String(payload.buyerId),
        payload.reason as string | undefined,
      );
    }
    if (eventType === 'TenantInviteCreatedEvent') {
      return new TenantInviteCreatedEvent(
        String(payload.inviteId),
        String(payload.tenantId),
        String(payload.email),
        String(payload.role),
        String(payload.token),
        payload.tenantName as string | undefined,
      );
    }
    if (eventType === 'TenantInviteAcceptedEvent') {
      return new TenantInviteAcceptedEvent(
        String(payload.inviteId),
        String(payload.tenantId),
        String(payload.userId),
        String(payload.email),
      );
    }
    return null;
  }
}
