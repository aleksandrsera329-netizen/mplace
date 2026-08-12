/** BullMQ queue names (Stage 19) */
export const QUEUE_EMAIL = 'emails';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_SEARCH = 'search-index';
export const QUEUE_IMPORTS = 'imports';
export const QUEUE_WEBHOOKS = 'webhooks';
export const QUEUE_DOCUMENTS = 'documents';
export const QUEUE_PAYOUTS = 'payouts';
export const QUEUE_INVENTORY = 'inventory';
export const QUEUE_IMAGES = 'image-processing';
export const QUEUE_AUDIT = 'audit';

export const ALL_QUEUE_NAMES = [
  QUEUE_EMAIL,
  QUEUE_NOTIFICATIONS,
  QUEUE_SEARCH,
  QUEUE_IMPORTS,
  QUEUE_WEBHOOKS,
  QUEUE_DOCUMENTS,
  QUEUE_PAYOUTS,
  QUEUE_INVENTORY,
  QUEUE_IMAGES,
  QUEUE_AUDIT,
] as const;
