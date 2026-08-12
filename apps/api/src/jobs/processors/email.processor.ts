import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_EMAIL } from '../../queue/queue.constants';

export type EmailJobData = {
  to: string;
  subject: string;
  body: string;
  template?: string;
  notificationId?: string;
  deliveryId?: string;
};

/**
 * Stage 19: async email worker.
 * Production: SMTP / SES / Resend. Demo: structured log + delivery status.
 */
@Processor(QUEUE_EMAIL)
export class EmailJobProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailJobProcessor.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    const { to, subject, body, deliveryId, notificationId, template } =
      job.data || ({} as EmailJobData);

    this.logger.log(
      `[email] job=${job.id} to=${to} subject=${subject} template=${template || 'raw'} notification=${notificationId || '-'}`,
    );

    // Demo channel: log body length; real provider goes here later
    if (body) {
      this.logger.debug(`[email] body_len=${body.length}`);
    }

    if (deliveryId && this.prisma) {
      await this.prisma.notificationDelivery
        .update({
          where: { id: deliveryId },
          data: { status: 'sent', sentAt: new Date(), error: null },
        })
        .catch((e) => {
          this.logger.warn(
            `delivery ${deliveryId} update failed: ${e instanceof Error ? e.message : e}`,
          );
        });
    }

    return { ok: true, mode: 'log', to, subject };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EmailJobData> | undefined, error: Error) {
    this.logger.error(
      `[email] job=${job?.id} failed: ${error.message}`,
    );
    const deliveryId = job?.data?.deliveryId;
    if (deliveryId && this.prisma) {
      const attempts = job.opts.attempts ?? 1;
      const isFinal = (job.attemptsMade ?? 0) >= attempts;
      if (isFinal) {
        await this.prisma.notificationDelivery
          .update({
            where: { id: deliveryId },
            data: {
              status: 'failed',
              error: error.message.slice(0, 500),
            },
          })
          .catch(() => null);
      }
    }
  }
}
