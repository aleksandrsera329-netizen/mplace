import { Prisma } from '@prisma/client';

/**
 * Dialect-aware atomic stock decrement.
 * SQLite: ? placeholders; PostgreSQL: $1..$n
 * Returns number of affected rows (0 = insufficient stock / wrong status).
 */
export function atomicStockDecrementSql(
  productId: string,
  quantity: number,
): Prisma.Sql {
  // Prisma.sql is parameterized for both SQLite and PostgreSQL
  return Prisma.sql`
    UPDATE "Product"
    SET stock = stock - ${quantity},
        "soldCount" = "soldCount" + ${quantity}
    WHERE id = ${productId}
      AND stock >= ${quantity}
      AND status = 'ACTIVE'
  `;
}
