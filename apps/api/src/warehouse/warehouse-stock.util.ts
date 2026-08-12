import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Pick default (or first active) warehouse for a shop.
 */
export async function resolveDefaultWarehouse(tx: Tx, shopId: string) {
  const warehouse = await tx.warehouse.findFirst({
    where: { merchantId: shopId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return warehouse;
}

/**
 * Available units at a warehouse (quantity - reserved).
 * If no ProductStock row, falls back to product.stock (legacy).
 */
export async function getAvailableAtWarehouse(
  tx: Tx,
  productId: string,
  warehouseId: string | null,
  legacyProductStock: number,
): Promise<number> {
  if (!warehouseId) {
    return legacyProductStock;
  }
  const row = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
  });
  if (!row) {
    // No multi-warehouse row yet — treat product.stock as available on this WH
    return legacyProductStock;
  }
  return Math.max(0, row.quantity - row.reserved);
}

/**
 * Reserve qty for an order line. Creates ProductStock if missing (from legacy stock).
 */
export async function reserveStock(
  tx: Tx,
  params: {
    productId: string;
    productName: string;
    quantity: number;
    warehouseId: string;
    legacyProductStock: number;
  },
) {
  const { productId, productName, quantity, warehouseId, legacyProductStock } =
    params;

  const existing = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
  });

  if (!existing) {
    // Seed row from aggregate product.stock, then reserve
    if (legacyProductStock < quantity) {
      throw new BadRequestException(
        `Недостаточно товара «${productName}». Доступно: ${legacyProductStock}`,
      );
    }
    await tx.productStock.create({
      data: {
        productId,
        warehouseId,
        quantity: legacyProductStock,
        reserved: quantity,
      },
    });
    return;
  }

  const available = existing.quantity - existing.reserved;
  if (available < quantity) {
    const wh = await tx.warehouse.findUnique({ where: { id: warehouseId } });
    throw new BadRequestException(
      `Недостаточно товара «${productName}» на складе ${wh?.name || warehouseId}. Доступно: ${available}`,
    );
  }

  await tx.productStock.update({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
    data: { reserved: { increment: quantity } },
  });
}

/**
 * After payment: convert reservation into real stock decrease.
 * Also sync Product.stock = sum(quantity).
 */
export async function commitReservedStock(
  tx: Tx,
  params: {
    productId: string;
    warehouseId: string | null;
    quantity: number;
  },
) {
  const { productId, warehouseId, quantity } = params;
  if (!warehouseId) {
    // Legacy path: only Product.stock
    const affected = await tx.product.updateMany({
      where: { id: productId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (affected.count === 0) {
      throw new Error(`stock_fail_${productId}`);
    }
    return;
  }

  const row = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
  });
  if (!row || row.reserved < quantity || row.quantity < quantity) {
    throw new Error(`stock_fail_${productId}`);
  }

  await tx.productStock.update({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
    data: {
      quantity: { decrement: quantity },
      reserved: { decrement: quantity },
    },
  });

  await syncProductStockAggregate(tx, productId);
}

/**
 * Cancel before fulfilment: release reservation (or restock if already committed via paid).
 */
export async function releaseReservation(
  tx: Tx,
  params: {
    productId: string;
    warehouseId: string | null;
    quantity: number;
    /** if true, stock was already committed (quantity decreased) — restock */
    restock: boolean;
  },
) {
  const { productId, warehouseId, quantity, restock } = params;
  if (!warehouseId) {
    if (restock) {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });
    }
    return;
  }

  const row = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
  });
  if (!row) return;

  if (restock) {
    // Paid then cancelled: put units back
    await tx.productStock.update({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      data: {
        quantity: { increment: quantity },
      },
    });
  } else {
    // Still pending payment: only free reserved
    const dec = Math.min(row.reserved, quantity);
    if (dec > 0) {
      await tx.productStock.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: { reserved: { decrement: dec } },
      });
    }
  }

  await syncProductStockAggregate(tx, productId);
}

export async function syncProductStockAggregate(tx: Tx, productId: string) {
  const agg = await tx.productStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const count = await tx.productStock.count({ where: { productId } });
  if (count > 0) {
    await tx.product.update({
      where: { id: productId },
      data: { stock: agg._sum.quantity ?? 0 },
    });
  }
}

export async function totalAvailableForProduct(
  tx: Tx,
  productId: string,
  legacyStock: number,
): Promise<number> {
  const stocks = await tx.productStock.findMany({ where: { productId } });
  if (!stocks.length) return legacyStock;
  return stocks.reduce(
    (sum, s) => sum + Math.max(0, s.quantity - s.reserved),
    0,
  );
}

export function assertProductFound<T>(product: T | null, id: string): asserts product is T {
  if (!product) {
    throw new NotFoundException(`Товар ${id} не найден`);
  }
}
