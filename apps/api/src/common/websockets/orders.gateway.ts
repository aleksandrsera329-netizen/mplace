import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-order')
  handleSubscribe(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.orderId) return { event: 'error', data: 'orderId required' };
    void client.join(`order:${data.orderId}`);
    this.logger.log(
      `Client ${client.id} subscribed to order ${data.orderId}`,
    );
    return { event: 'subscribed', data: { orderId: data.orderId } };
  }

  @SubscribeMessage('subscribe-user')
  handleSubscribeUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.userId) return { event: 'error', data: 'userId required' };
    void client.join(`user:${data.userId}`);
    this.logger.log(`Client ${client.id} joined user:${data.userId}`);
    return { event: 'subscribed-user', data: { userId: data.userId } };
  }

  emitUserNotification(
    userId: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderStatusChanged(
    orderId: string,
    status: string,
    payload?: Record<string, unknown>,
  ) {
    if (!this.server) return;
    this.server.to(`order:${orderId}`).emit('order-status-changed', {
      orderId,
      status,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderCreated(orderId: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    this.server.to(`order:${orderId}`).emit('order-created', {
      orderId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
    // also broadcast to customer room if present
    if (payload.customerId) {
      this.server
        .to(`user:${payload.customerId}`)
        .emit('order-created', {
          orderId,
          ...payload,
          timestamp: new Date().toISOString(),
        });
    }
  }
}
