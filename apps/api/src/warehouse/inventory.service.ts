import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  commitReservedStock,
  releaseReservation as releaseWarehouseReserved,
  reserveStock,
} from './warehouse-stock.util';

const DEFAULT_TTL_MINUTES = 30;

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Available units: product.stock − ACTIVE non-expired reservations
   * (or ProductStock qty−reserved when warehouse stocks exist).
   */
  async getAvailable(
    productId: string,
    tx?: Tx,
  ): Promise<{ stock: number; reserved: number; available: number }> {
    const db = tx || this.prisma;
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const stocks = await db.productStock.findMany({ where: { productId } });
    if (stocks.length > 0) {
      const stock = stocks.reduce((s, r) => s + r.quantity, 0);
      const reserved = stocks.reduce((s, r) => s + r.reserved, 0);
      return {
        stock,
        reserved,
        available: Math.max(0, stock - reserved),
      };
    }

    const active = await db.inventoryReservation.aggregate({
      where: {
        productId,
        status: ReservationStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });
    const reserved = active._sum.quantity || 0;
    return {
      stock: product.stock,
      reserved,
      available: Math.max(0, product.stock - reserved),
    };
  }

  /**
   * Atomic reserve under Product FOR UPDATE.
   * Does not decrement product.stock — only holds units until confirm/expiry.
   */
  async reserve(params: {
    productId: string;
    quantity: number;
    orderId: string;
    warehouseId?: string | null;
    productName?: string;
    ttlMinutes?: number;
    tx?: Tx;
  }) {
    const {
      productId,
      quantity,
      orderId,
      warehouseId,
      ttlMinutes = DEFAULT_TTL_MINUTES,
    } = params;
    if (quantity <= 0) {
      throw new BadRequestException('Invalid quantity');
    }

    const run = async (tx: Tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`,
      );

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      // Expire stale ACTIVE rows for this product before checking
      await tx.inventoryReservation.updateMany({
        where: {
          productId,
          status: ReservationStatus.ACTIVE,
          expiresAt: { lt: new Date() },
        },
        data: { status: ReservationStatus.EXPIRED },
      });

      const { available } = await this.getAvailable(productId, tx);
      if (available < quantity) {
        throw new BadRequestException(
          `Insufficient stock${params.productName ? ` for «${params.productName}»` : ''}. Available: ${available}`,
        );
      }

      // Multi-warehouse operational lock (ProductStock.reserved)
      if (warehouseId) {
        await reserveStock(tx, {
          productId,
          productName: params.productName || product.name,
          quantity,
          warehouseId,
          legacyProductStock: product.stock,
        });
      }

      const reservation = await tx.inventoryReservation.create({
        data: {
          productId,
          orderId,
          warehouseId: warehouseId || null,
          quantity,
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { reservedStock: { increment: quantity } },
      });

      return reservation;
    };

    if (params.tx) return run(params.tx);
    return this.prisma.$transaction((tx) => run(tx));
  }

  /**
   * Payment success: CONFIRM reservations + decrement physical stock.
   */
  async confirm(orderId: string, tx?: Tx) {
    const run = async (client: Tx) => {
      const reservations = await client.inventoryReservation.findMany({
        where: {
          orderId,
          status: ReservationStatus.ACTIVE,
        },
      });

      for (const r of reservations) {
        await client.$executeRaw(
          Prisma.sql`SELECT id FROM "Product" WHERE id = ${r.productId} FOR UPDATE`,
        );

        if (r.warehouseId) {
          await commitReservedStock(client, {
            productId: r.productId,
            warehouseId: r.warehouseId,
            quantity: r.quantity,
          });
        } else {
          const affected = await client.product.updateMany({
            where: { id: r.productId, stock: { gte: r.quantity } },
            data: { stock: { decrement: r.quantity } },
          });
          if (affected.count === 0) {
            throw new Error(`stock_fail_${r.productId}`);
          }
        }

        await client.inventoryReservation.update({
          where: { id: r.id },
          data: { status: ReservationStatus.CONFIRMED },
        });

        await client.product.update({
          where: { id: r.productId },
          data: {
            reservedStock: { decrement: Math.min(r.quantity, 999999) },
          },
        });
        // clamp reservedStock >= 0
        await client.$executeRaw(
          Prisma.sql`UPDATE "Product" SET "reservedStock" = GREATEST(0, "reservedStock") WHERE id = ${r.productId}`,
        );
      }

      return { confirmed: reservations.length };
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((client) => run(client));
  }

  /**
   * Cancel / failed payment: free ACTIVE reservations without stock decrement.
   */
  async releaseOrder(orderId: string, tx?: Tx) {
    const run = async (client: Tx) => {
      const reservations = await client.inventoryReservation.findMany({
        where: {
          orderId,
          status: ReservationStatus.ACTIVE,
        },
      });

      for (const r of reservations) {
        if (r.warehouseId) {
          await releaseWarehouseReserved(client, {
            productId: r.productId,
            warehouseId: r.warehouseId,
            quantity: r.quantity,
            restock: false,
          });
        }
        await client.inventoryReservation.update({
          where: { id: r.id },
          data: { status: ReservationStatus.RELEASED },
        });
        await client.product.update({
          where: { id: r.productId },
          data: { reservedStock: { decrement: r.quantity } },
        });
        await client.$executeRaw(
          Prisma.sql`UPDATE "Product" SET "reservedStock" = GREATEST(0, "reservedStock") WHERE id = ${r.productId}`,
        );
      }
      return { released: reservations.length };
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((client) => run(client));
  }

  /**
   * Cron-friendly: ACTIVE past expiresAt → EXPIRED + free warehouse reserved.
   */
  async releaseExpired() {
    const now = new Date();
    const expired = await this.prisma.inventoryReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: now },
      },
    });

    let count = 0;
    for (const r of expired) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.inventoryReservation.findUnique({
          where: { id: r.id },
        });
        if (!current || current.status !== ReservationStatus.ACTIVE) return;

        if (current.warehouseId) {
          await releaseWarehouseReserved(tx, {
            productId: current.productId,
            warehouseId: current.warehouseId,
            quantity: current.quantity,
            restock: false,
          });
        }
        await tx.inventoryReservation.update({
          where: { id: r.id },
          data: { status: ReservationStatus.EXPIRED },
        });
        await tx.product.update({
          where: { id: current.productId },
          data: { reservedStock: { decrement: current.quantity } },
        });
        await tx.$executeRaw(
          Prisma.sql`UPDATE "Product" SET "reservedStock" = GREATEST(0, "reservedStock") WHERE id = ${current.productId}`,
        );
        count++;
      });
    }
    if (count > 0) {
      this.logger.log(`Expired ${count} inventory reservation(s)`);
    }
    return { expired: count };
  }
}
