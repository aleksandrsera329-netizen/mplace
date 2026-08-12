import { Test } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (Stage 18)', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationDelivery: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(NotificationsService);
    jest.clearAllMocks();
  });

  it('notify creates Notification + Delivery rows and marks IN_APP sent', async () => {
    const created = {
      id: 'n1',
      userId: 'u1',
      type: NotificationType.ORDER_PAID,
      title: 'Заказ оплачен',
      message: 'Order #1 paid',
      data: { orderId: 'o1' },
      link: '/orders/o1',
      isRead: false,
      readAt: null,
      createdAt: new Date(),
      deliveries: [
        {
          id: 'd-inapp',
          channel: NotificationChannel.IN_APP,
          status: 'pending',
        },
        {
          id: 'd-email',
          channel: NotificationChannel.EMAIL,
          status: 'pending',
        },
      ],
    };
    mockPrisma.notification.create.mockResolvedValue(created);
    mockPrisma.notificationDelivery.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      email: 'buyer@test.local',
      name: 'Buyer',
    });
    mockPrisma.notification.findUnique.mockResolvedValue({
      ...created,
      deliveries: [
        { ...created.deliveries[0], status: 'sent' },
        { ...created.deliveries[1], status: 'sent' },
      ],
    });

    const result = await service.notify({
      userId: 'u1',
      type: NotificationType.ORDER_PAID,
      title: 'Заказ оплачен',
      body: 'Order #1 paid',
      data: { orderId: 'o1' },
      link: '/orders/o1',
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          type: NotificationType.ORDER_PAID,
          title: 'Заказ оплачен',
          message: 'Order #1 paid',
          deliveries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                channel: NotificationChannel.IN_APP,
                status: 'pending',
              }),
              expect.objectContaining({
                channel: NotificationChannel.EMAIL,
                status: 'pending',
              }),
            ]),
          },
        }),
      }),
    );
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd-inapp' },
        data: expect.objectContaining({ status: 'sent' }),
      }),
    );
    // offline email → marked sent
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd-email' },
        data: expect.objectContaining({ status: 'sent' }),
      }),
    );
    expect(result?.id).toBe('n1');
  });

  it('listForUser returns unread first with body alias', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n2',
        message: 'hello',
        isRead: false,
        createdAt: new Date(),
        deliveries: [],
      },
    ]);
    mockPrisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const page = await service.listForUser('u1', { page: 1, limit: 20 });
    expect(page.items[0].body).toBe('hello');
    expect(page.total).toBe(1);
    expect(page.unread).toBe(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('markAsRead scopes to own userId', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markAsRead('n1', 'u1');
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'u1' },
      data: expect.objectContaining({ isRead: true }),
    });
  });

  it('create maps message → body and respects sendEmail=false', async () => {
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n3',
      deliveries: [
        {
          id: 'd1',
          channel: NotificationChannel.IN_APP,
          status: 'pending',
        },
      ],
    });
    mockPrisma.notificationDelivery.update.mockResolvedValue({});
    mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n3' });

    await service.create({
      userId: 'u1',
      type: 'RFQ_CREATED',
      title: 'RFQ',
      message: 'created',
      sendEmail: false,
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'created',
          type: NotificationType.RFQ_CREATED,
          deliveries: {
            create: [
              {
                channel: NotificationChannel.IN_APP,
                status: 'pending',
              },
            ],
          },
        }),
      }),
    );
  });
});
