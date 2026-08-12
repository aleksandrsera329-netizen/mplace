/**
 * Stage 19 — queue name registry + default job options.
 * Actual Queue instances come from NestJS BullModule / InjectQueue.
 */
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
} from '../queue/queue.constants';

export const JobQueues = {
  emails: QUEUE_EMAIL,
  notifications: QUEUE_NOTIFICATIONS,
  searchIndex: QUEUE_SEARCH,
  imports: QUEUE_IMPORTS,
  webhooks: QUEUE_WEBHOOKS,
  documents: QUEUE_DOCUMENTS,
  payouts: QUEUE_PAYOUTS,
  inventory: QUEUE_INVENTORY,
  images: QUEUE_IMAGES,
  audit: QUEUE_AUDIT,
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];

/** Default options: retry with exponential backoff */
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export const importJobOptions = {
  ...defaultJobOptions,
  attempts: 2,
  // Heavy work — don't stampede retries
  backoff: { type: 'fixed' as const, delay: 10_000 },
};

export const inventoryRepeatMs = 5 * 60 * 1000; // 5 minutes
