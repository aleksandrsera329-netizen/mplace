import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * TZ2 Stage 3 — WebSockets
 * Rooms: user:{id}, shop:{id}, rfq:{id}, order:{id}
 */
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/ws',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`ws connect ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`ws disconnect ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { rooms?: string[] },
  ) {
    const rooms = body?.rooms || [];
    for (const room of rooms) {
      if (typeof room === 'string' && room.length < 120) {
        void client.join(room);
      }
    }
    return { ok: true, rooms };
  }

  /** Emit order status to interested parties */
  notifyOrderStatus(payload: {
    orderId: string;
    shopId?: string;
    customerId?: string | null;
    status: string;
    orderNumber?: string;
  }) {
    if (!this.server) return;
    this.server.to(`order:${payload.orderId}`).emit('order.status', payload);
    if (payload.shopId) {
      this.server.to(`shop:${payload.shopId}`).emit('order.status', payload);
    }
    if (payload.customerId) {
      this.server
        .to(`user:${payload.customerId}`)
        .emit('order.status', payload);
    }
  }

  notifyRfq(payload: {
    rfqId: string;
    buyerId?: string;
    event: string;
    data?: Record<string, unknown>;
  }) {
    if (!this.server) return;
    this.server.to(`rfq:${payload.rfqId}`).emit('rfq.event', payload);
    if (payload.buyerId) {
      this.server.to(`user:${payload.buyerId}`).emit('rfq.event', payload);
    }
  }
}
