import {
  forwardRef,
  Global,
  Logger,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JobsModule } from '../jobs/jobs.module';
import { QueueProducer } from './queue.producer';
import { SearchIndexProcessor } from './processors/search-index.processor';
import {
  QUEUE_AUDIT,
  QUEUE_DOCUMENTS,
  QUEUE_EMAIL,
  QUEUE_IMAGES,
  QUEUE_IMPORTS,
  QUEUE_INVENTORY,
  QUEUE_NOTIFICATIONS,
  QUEUE_PAYOUTS,
  QUEUE_SEARCH,
  QUEUE_WEBHOOKS,
} from './queue.constants';

function redisConnection(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port || 6379),
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null as null,
    };
  }
}

const redisUrl = process.env.REDIS_URL;
const conn = redisConnection(redisUrl);

@Global()
@Module({
  imports: [
    ConfigModule,
    ...(conn
      ? [
          BullModule.forRoot({
            connection: conn,
          }),
          BullModule.registerQueue(
            { name: QUEUE_EMAIL },
            { name: QUEUE_NOTIFICATIONS },
            { name: QUEUE_SEARCH },
            { name: QUEUE_IMPORTS },
            { name: QUEUE_WEBHOOKS },
            { name: QUEUE_DOCUMENTS },
            { name: QUEUE_PAYOUTS },
            { name: QUEUE_INVENTORY },
            { name: QUEUE_IMAGES },
            { name: QUEUE_AUDIT },
          ),
          // Workers + periodic schedules (Stage 19)
          forwardRef(() => JobsModule),
        ]
      : []),
  ],
  providers: [
    QueueProducer,
    ...(conn ? [SearchIndexProcessor] : []),
  ],
  exports: [
    QueueProducer,
    ...(conn ? [BullModule, forwardRef(() => JobsModule)] : []),
  ],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (!this.config.get<string>('REDIS_URL') && !process.env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL not set — BullMQ queues disabled (inline fallbacks only)',
      );
    } else {
      this.logger.log(
        'BullMQ queues: emails, notifications, search-index, imports, webhooks, documents, payouts, inventory, …',
      );
    }
  }
}
