import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailJobProcessor } from './email.processor';

describe('EmailJobProcessor (Stage 19)', () => {
  let processor: EmailJobProcessor;
  const mockPrisma = {
    notificationDelivery: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        EmailJobProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    processor = mod.get(EmailJobProcessor);
    jest.clearAllMocks();
  });

  it('marks NotificationDelivery sent when deliveryId present', async () => {
    const result = await processor.process({
      id: 'job-1',
      data: {
        to: 'buyer@test.local',
        subject: 'Order paid',
        body: 'Thanks',
        deliveryId: 'del-1',
        notificationId: 'n-1',
      },
      opts: { attempts: 3 },
      attemptsMade: 1,
    } as never);

    expect(result).toEqual(
      expect.objectContaining({ ok: true, mode: 'log', to: 'buyer@test.local' }),
    );
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'del-1' },
      data: expect.objectContaining({ status: 'sent' }),
    });
  });
});
