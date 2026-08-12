/** One-shot: seed RolePermission for ADMIN + SUPER_ADMIN without full db seed */
const { PrismaClient, Permission, UserRole } = require('@prisma/client');

const prisma = new PrismaClient();
const perms = Object.values(Permission);

async function main() {
  for (const role of [UserRole.ADMIN, UserRole.SUPER_ADMIN]) {
    for (const permission of perms) {
      await prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission },
        update: {},
      });
    }
  }
  const n = await prisma.rolePermission.count();
  console.log('rolePermission count=', n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
