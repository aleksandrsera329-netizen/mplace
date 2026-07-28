import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      customers,
      merchants,
      orders,
      pendingShops,
      openDisputes,
      products,
      todayOrders,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({ where: { role: UserRole.MERCHANT } }),
      this.prisma.order.count(),
      this.prisma.shop.count({ where: { status: 'PENDING' } }),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'APPEALED'] } },
      }),
      this.prisma.product.count(),
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: startOfDay },
          status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] },
        },
        select: { totalCents: true },
      }),
    ]);

    const todayTotalCents = todayOrders.reduce((s, o) => s + o.totalCents, 0);

    return {
      customers,
      merchants,
      orders,
      products,
      pendingVerifications: pendingShops,
      appealedDisputes: openDisputes,
      todayTotalCents,
      todayTotal: (todayTotalCents / 100).toFixed(2),
    };
  }

  @Get('customers')
  customers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.CUSTOMER },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });
  }

  @Get('merchants')
  merchants() {
    return this.prisma.user.findMany({
      where: { role: UserRole.MERCHANT },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            verified: true,
            _count: { select: { products: true, orders: true } },
          },
        },
      },
    });
  }
}
