import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  QUEUE_EMAIL,
  QUEUE_IMPORTS,
  QUEUE_INVENTORY,
  QUEUE_NOTIFICATIONS,
  QUEUE_SEARCH,
} from '../queue/queue.constants';
import { QueueProducer } from '../queue/queue.producer';

describe('QueueProducer (Stage 19)', () => {
  let producer: QueueProducer;
  const emailAdd = jest.fn().mockResolvedValue({ id: 'e1' });
  const importAdd = jest.fn().mockResolvedValue({ id: 'i1' });
  const inventoryAdd = jest.fn().mockResolvedValue({ id: 'v1' });

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        QueueProducer,
        {
          provide: getQueueToken(QUEUE_EMAIL),
          useValue: { add: emailAdd },
        },
        {
          provide: getQueueToken(QUEUE_NOTIFICATIONS),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'n1' }) },
        },
        {
          provide: getQueueToken(QUEUE_SEARCH),
          useValue: { add: jest.fn().mockResolvedValue({ id: 's1' }) },
        },
        {
          provide: getQueueToken(QUEUE_IMPORTS),
          useValue: { add: importAdd },
        },
        {
          provide: getQueueToken(QUEUE_INVENTORY),
          useValue: { add: inventoryAdd },
        },
      ],
    }).compile();
    producer = mod.get(QueueProducer);
    jest.clearAllMocks();
    emailAdd.mockResolvedValue({ id: 'e1' });
    importAdd.mockResolvedValue({ id: 'i1' });
    inventoryAdd.mockResolvedValue({ id: 'v1' });
  });

  it('enqueueEmail adds send job with retries', async () => {
    const r = await producer.enqueueEmail({
      to: 'a@b.c',
      subject: 'Hi',
      body: 'Hello',
      deliveryId: 'd1',
    });
    expect(r).toEqual({ queued: true, jobId: 'e1' });
    expect(emailAdd).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ to: 'a@b.c', deliveryId: 'd1' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('enqueueImport uses stable jobId for de-dupe', async () => {
    const r = await producer.enqueueImport({
      importJobId: 'imp-9',
      shopId: 'shop-1',
      actorId: 'u1',
    });
    expect(r.queued).toBe(true);
    expect(importAdd).toHaveBeenCalledWith(
      'process-import',
      expect.objectContaining({ importJobId: 'imp-9' }),
      expect.objectContaining({ jobId: 'import-imp-9' }),
    );
  });

  it('enqueueInventoryRelease enqueues release-expired', async () => {
    const r = await producer.enqueueInventoryRelease();
    expect(r).toEqual({ queued: true, jobId: 'v1' });
    expect(inventoryAdd).toHaveBeenCalledWith(
      'release-expired',
      {},
      expect.any(Object),
    );
  });
});
