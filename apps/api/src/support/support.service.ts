import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  RefundStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  listTickets(user: JwtPayload) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.ticket.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
        },
      });
    }
    return this.prisma.ticket.findMany({
      where: { authorId: user.sub },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async createTicket(
    user: JwtPayload,
    data: { subject: string; body: string; type?: string; priority?: string },
  ) {
    return this.prisma.ticket.create({
      data: {
        authorId: user.sub,
        subject: data.subject,
        body: data.body,
        type: data.type || 'general',
        priority: (data.priority as 'LOW' | 'NORMAL' | 'HIGH') || 'NORMAL',
      },
    });
  }

  async addTicketMessage(user: JwtPayload, ticketId: string, body: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException();
    if (
      user.role !== UserRole.ADMIN &&
      ticket.authorId !== user.sub
    ) {
      throw new ForbiddenException();
    }
    return this.prisma.ticketMessage.create({
      data: { ticketId, authorId: user.sub, body },
    });
  }

  async updateTicketStatus(
    user: JwtPayload,
    id: string,
    status: TicketStatus,
  ) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.ticket.update({ where: { id }, data: { status } });
  }

  listDisputes(user: JwtPayload) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.dispute.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              shopId: true,
              customerId: true,
              totalCents: true,
            },
          },
        },
      });
    }
    if (user.role === UserRole.MERCHANT && user.shopId) {
      return this.prisma.dispute.findMany({
        where: { order: { shopId: user.shopId } },
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { id: true, orderNumber: true } } },
      });
    }
    return this.prisma.dispute.findMany({
      where: { order: { customerId: user.sub } },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { id: true, orderNumber: true } } },
    });
  }

  async createDispute(user: JwtPayload, orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (
      user.role === UserRole.CUSTOMER &&
      order.customerId !== user.sub
    ) {
      throw new ForbiddenException();
    }
    if (
      user.role === UserRole.MERCHANT &&
      order.shopId !== user.shopId
    ) {
      throw new ForbiddenException();
    }
    const dispute = await this.prisma.dispute.create({
      data: { orderId, reason },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPUTED' },
    });
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: 'DISPUTED',
        actorId: user.sub,
        reason,
      },
    });
    return dispute;
  }

  async resolveDispute(
    user: JwtPayload,
    id: string,
    resolution: string,
    status: DisputeStatus = DisputeStatus.RESOLVED,
  ) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.dispute.update({
      where: { id },
      data: { resolution, status },
    });
  }

  listRefunds(user: JwtPayload) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.refund.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { id: true, orderNumber: true, totalCents: true } },
        },
      });
    }
    if (user.role === UserRole.MERCHANT && user.shopId) {
      return this.prisma.refund.findMany({
        where: { order: { shopId: user.shopId } },
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { id: true, orderNumber: true } } },
      });
    }
    return this.prisma.refund.findMany({
      where: { order: { customerId: user.sub } },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { id: true, orderNumber: true } } },
    });
  }

  async requestRefund(
    user: JwtPayload,
    orderId: string,
    amountCents: number,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException();
    if (user.role === UserRole.CUSTOMER && order.customerId !== user.sub) {
      throw new ForbiddenException();
    }
    if (amountCents <= 0 || amountCents > order.totalCents) {
      throw new ForbiddenException('Invalid refund amount');
    }
    return this.prisma.refund.create({
      data: {
        orderId,
        amountCents,
        reason: reason || null,
        status: RefundStatus.PENDING,
      },
    });
  }

  async decideRefund(
    user: JwtPayload,
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'COMPLETED',
    adminNote?: string,
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.MERCHANT) {
      throw new ForbiddenException();
    }
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!refund) throw new NotFoundException();
    if (
      user.role === UserRole.MERCHANT &&
      refund.order.shopId !== user.shopId
    ) {
      throw new ForbiddenException();
    }
    // Full provider refund integration is P1+; mark status only for now
    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: status as RefundStatus,
        adminNote: adminNote || null,
      },
    });
    if (status === 'COMPLETED' || status === 'APPROVED') {
      await this.prisma.order.update({
        where: { id: refund.orderId },
        data: {
          status:
            refund.amountCents >= refund.order.totalCents
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: `refund.${status.toLowerCase()}`,
        entityType: 'Refund',
        entityId: id,
      },
    });
    return updated;
  }

  listAudit(user: JwtPayload) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, email: true, name: true } } },
    });
  }
}
