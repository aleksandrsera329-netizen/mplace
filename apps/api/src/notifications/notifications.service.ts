import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_EMAIL, QUEUE_NOTIFICATIONS } from '../queue/queue.constants';
import { OrdersGateway } from '../common/websockets/orders.gateway';

export type CreateNotificationParams = {
  tenantId?: string | null;
  userId: string;
  type: NotificationType | string;
  title: string;
  message?: string;
  /** Alias for message (Stage 18 API) */
  body?: string;
  data?: Record<string, unknown>;
  link?: string;
  sendEmail?: boolean;
  sendTelegram?: boolean;
  channels?: NotificationChannel[];
};

export type NotifyParams = {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  tenantId?: string | null;
  link?: string;
};

const DEFAULT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
];

function toNotificationType(type: NotificationType | string): NotificationType {
  if (
    Object.values(NotificationType).includes(type as NotificationType)
  ) {
    return type as NotificationType;
  }
  // Legacy string fallbacks
  const upper = String(type).toUpperCase();
  if (upper in NotificationType) {
    return upper as NotificationType;
  }
  return NotificationType.SYSTEM;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_EMAIL)
    private readonly emailsQueue?: Queue,
    @Optional() private readonly ordersGateway?: OrdersGateway,
  ) {}

  /**
   * Stage 18: durable notification + per-channel delivery records.
   * IN_APP marked sent immediately; EMAIL queued/logged (Stage 19 polish).
   */
  async notify(params: NotifyParams) {
    if (!params.userId) {
      this.logger.warn('notify skipped: no userId');
      return null;
    }

    const type = toNotificationType(params.type);
    const body = params.body ?? '';
    const channels: NotificationChannel[] =
      params.channels && params.channels.length > 0
        ? params.channels
        : DEFAULT_CHANNELS;

    const notification = await this.prisma.notification.create({
      data: {
        tenantId: params.tenantId ?? null,
        userId: params.userId,
        type,
        title: params.title,
        message: body,
        data: (params.data || {}) as Prisma.InputJsonValue,
        link: params.link ?? null,
        deliveries: {
          create: channels.map((channel) => ({
            channel,
            status: 'pending',
          })),
        },
      },
      include: { deliveries: true },
    });

    // IN_APP: mark delivered + push websocket
    const inApp = notification.deliveries.find(
      (d) => d.channel === NotificationChannel.IN_APP,
    );
    if (inApp) {
      await this.prisma.notificationDelivery.update({
        where: { id: inApp.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      this.ordersGateway?.emitUserNotification(params.userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        body: notification.message,
        link: notification.link,
        data: notification.data,
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      });
    }

    // EMAIL: queue or log; update delivery status
    const emailDelivery = notification.deliveries.find(
      (d) => d.channel === NotificationChannel.EMAIL,
    );
    if (emailDelivery) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { email: true, name: true },
        });
        if (user?.email) {
          if (this.emailsQueue) {
            await this.emailsQueue.add(
              'send',
              {
                to: user.email,
                subject: params.title,
                body: [params.title, '', body, params.link ? `\n${params.link}` : '']
                  .filter(Boolean)
                  .join('\n'),
                template: 'notification',
                notificationId: notification.id,
                deliveryId: emailDelivery.id,
              },
              { attempts: 2, removeOnComplete: 50 },
            );
            // remains pending until Stage 19 worker confirms
          } else {
            this.logger.log(
              `[email offline] → ${user.email}: ${params.title}`,
            );
            await this.prisma.notificationDelivery.update({
              where: { id: emailDelivery.id },
              data: { status: 'sent', sentAt: new Date() },
            });
          }
        } else {
          await this.prisma.notificationDelivery.update({
            where: { id: emailDelivery.id },
            data: {
              status: 'failed',
              error: 'no user email',
              sentAt: new Date(),
            },
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.prisma.notificationDelivery.update({
          where: { id: emailDelivery.id },
          data: { status: 'failed', error: msg.slice(0, 500) },
        });
      }
    }

    return this.prisma.notification.findUnique({
      where: { id: notification.id },
      include: { deliveries: true },
    });
  }

  /** Backward-compatible create → notify */
  async create(params: CreateNotificationParams) {
    const channels: NotificationChannel[] = params.channels
      ? params.channels
      : [
          NotificationChannel.IN_APP,
          ...(params.sendEmail === false
            ? []
            : [NotificationChannel.EMAIL]),
        ];

    return this.notify({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? params.message ?? '',
      data: params.data,
      channels,
      tenantId: params.tenantId,
      link: params.link,
    });
  }

  /** Real-time + email delivery (called by processor or inline) */
  async deliver(notificationId: string, sendEmail = true) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        deliveries: true,
      },
    });
    if (!notification) return { ok: false };

    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      body: notification.message,
      link: notification.link,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };

    this.ordersGateway?.emitUserNotification(notification.userId, payload);

    // Mark IN_APP sent if still pending
    const pendingInApp = notification.deliveries.filter(
      (d) =>
        d.channel === NotificationChannel.IN_APP && d.status === 'pending',
    );
    for (const d of pendingInApp) {
      await this.prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    }

    if (sendEmail && notification.user?.email) {
      if (this.emailsQueue) {
        await this.emailsQueue.add(
          'send',
          {
            to: notification.user.email,
            subject: notification.title,
            body: [
              notification.title,
              '',
              notification.message,
              notification.link ? `\n${notification.link}` : '',
            ].join('\n'),
            template: 'notification',
            notificationId,
          },
          { attempts: 2, removeOnComplete: 50 },
        );
      } else {
        this.logger.log(
          `[email offline] → ${notification.user.email}: ${notification.title}`,
        );
        const emailD = notification.deliveries.find(
          (d) => d.channel === NotificationChannel.EMAIL,
        );
        if (emailD && emailD.status === 'pending') {
          await this.prisma.notificationDelivery.update({
            where: { id: emailD.id },
            data: { status: 'sent', sentAt: new Date() },
          });
        }
      }
    }

    return { ok: true, notificationId };
  }

  async listForUser(
    userId: string,
    opts: {
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        // Unread first, then newest
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { deliveries: true },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items: items.map((n) => ({
        ...n,
        body: n.message,
      })),
      total,
      unread,
      page,
      limit,
      pageCount: Math.ceil(total / limit) || 1,
    };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Helper: notify all owners of a shop */
  async notifyShopOwners(
    shopId: string,
    params: Omit<CreateNotificationParams, 'userId'>,
  ) {
    const owners = await this.prisma.user.findMany({
      where: { shopId },
      select: { id: true, tenantId: true },
    });
    const results = [];
    for (const o of owners) {
      results.push(
        await this.create({
          ...params,
          userId: o.id,
          tenantId: params.tenantId ?? o.tenantId,
        }),
      );
    }
    return results;
  }
}
