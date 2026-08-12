import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_EMAIL } from '../queue.constants';

@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job) {
    // Production: SMTP / SES. Demo: log only.
    this.logger.log(
      `[email] job=${job.id} to=${job.data?.to} subject=${job.data?.subject}`,
    );
    return { ok: true, mode: 'log' };
  }
}
