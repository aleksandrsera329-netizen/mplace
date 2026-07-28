import { PrismaClient, ProductStatus } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const shop = await p.shop.findFirst({ where: { slug: "big-shop" } });
  const cat = await p.category.findFirst();
  const items = [
    { name: "Classic Leather Watch", slug: "classic-watch", priceCents: 14900, stock: 30, soldCount: 8 },
    { name: "Running Shoes X200", slug: "running-shoes", priceCents: 7950, stock: 100, soldCount: 22 },
    { name: "Yoga Mat Premium", slug: "yoga-mat", priceCents: 2900, stock: 200, soldCount: 15 },
  ];
  for (const it of items) {
    await p.product.upsert({
      where: { shopId_slug: { shopId: shop.id, slug: it.slug } },
      update: {},
      create: { ...it, shopId: shop.id, categoryId: cat?.id, status: ProductStatus.ACTIVE, currency: "USD" },
    });
  }
  console.log("extra products ok", await p.product.count());
}
main().finally(() => p.$disconnect());
