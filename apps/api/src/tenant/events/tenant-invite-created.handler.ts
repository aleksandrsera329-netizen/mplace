import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TenantInviteCreatedEvent } from '../../common/events/tenant-invite-created.event';
import { QueueProducer } from '../../queue/queue.producer';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
@EventsHandler(TenantInviteCreatedEvent)
export class TenantInviteCreatedHandler
  implements IEventHandler<TenantInviteCreatedEvent>
{
  private readonly logger = new Logger(TenantInviteCreatedHandler.name);

  constructor(
    private readonly queue: QueueProducer,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async handle(event: TenantInviteCreatedEvent) {
    const webUrl =
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const inviteLink = `${webUrl.replace(/\/$/, '')}/invite/${event.token}`;
    const tenantLabel = event.tenantName || event.tenantId;

    this.logger.log(
      `Invite email → ${event.email} role=${event.role} link=${inviteLink}`,
    );

    await this.queue.enqueueEmail({
      to: event.email,
      subject: `Приглашение в ${tenantLabel}`,
      body: [
        `Вас пригласили присоединиться к «${tenantLabel}» (роль: ${event.role}).`,
        ``,
        `Перейдите по ссылке и задайте пароль:`,
        inviteLink,
        ``,
        `Ссылка действует 7 дней.`,
      ].join('\n'),
      template: 'tenant-invite',
    });

    // If user already exists (re-invite path), also in-app notify
    const existing = await this.prisma.user.findUnique({
      where: { email: event.email.toLowerCase() },
      select: { id: true, tenantId: true },
    });
    if (existing) {
      await this.notifications.create({
        tenantId: event.tenantId || existing.tenantId,
        userId: existing.id,
        type: 'INVITE',
        title: 'Приглашение в команду',
        message: `Вас пригласили в «${tenantLabel}»`,
        data: { inviteId: event.inviteId, token: event.token },
        link: `/invite/${event.token}`,
        sendEmail: false,
      });
    }
  }
}
