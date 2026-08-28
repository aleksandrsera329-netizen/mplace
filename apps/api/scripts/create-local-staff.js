const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const adminPass = "Adm#Mplace2026";
  const sellerPass = "Sell#Mplace2026";
  const adminHash = await bcrypt.hash(adminPass, 12);
  const sellerHash = await bcrypt.hash(sellerPass, 12);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: "mplace-demo" },
  });
  if (!tenant) throw new Error("tenant missing");

  const admin = await prisma.user.upsert({
    where: { email: "admin@mplace.local" },
    update: {
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: "admin@mplace.local",
      passwordHash: adminHash,
      name: "Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  let shop = await prisma.shop.findUnique({ where: { slug: "mplace-supply" } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        name: "Mplace Supply",
        slug: "mplace-supply",
        tenantId: tenant.id,
        description: "Platform merchant account",
        status: "ACTIVE",
        verified: true,
      },
    });
  }

  const existingSeller = await prisma.user.findUnique({
    where: { email: "seller@mplace.local" },
  });
  if (existingSeller) {
    await prisma.user.update({
      where: { email: "seller@mplace.local" },
      data: {
        passwordHash: sellerHash,
        role: "MERCHANT",
        status: "ACTIVE",
        shopId: shop.id,
        emailVerifiedAt: new Date(),
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email: "seller@mplace.local",
        passwordHash: sellerHash,
        name: "Store Owner",
        role: "MERCHANT",
        status: "ACTIVE",
        shopId: shop.id,
        tenantId: tenant.id,
        emailVerifiedAt: new Date(),
      },
    });
  }

  console.log("CREATED");
  console.log("ADMIN email=admin@mplace.local password=" + adminPass);
  console.log("SELLER email=seller@mplace.local password=" + sellerPass);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
