import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔐 Seeding admin users...");

  const email = process.env.ADMIN_SEED_EMAIL || "admin@locateflow.com";
  const plainPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!plainPassword || plainPassword.length < 16) {
    throw new Error(
      "ADMIN_SEED_PASSWORD must be set and at least 16 characters.\n" +
      "It must contain uppercase, lowercase, digit, and special character.\n" +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\""
    );
  }
  if (!/[A-Z]/.test(plainPassword) || !/[a-z]/.test(plainPassword) ||
      !/[0-9]/.test(plainPassword) || !/[^A-Za-z0-9]/.test(plainPassword)) {
    throw new Error(
      "ADMIN_SEED_PASSWORD must contain at least one uppercase letter, one lowercase letter, one digit, and one special character."
    );
  }

  console.warn("⚠️  WARNING: Change the default admin password immediately after first login!");

  const password = await bcrypt.hash(plainPassword, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      email,
      password,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`  ✓ Super Admin ensured: ${admin.email}`);

  // Create default permissions for SUPER_ADMIN
  const resources = [
    "users", "subscriptions", "reviews", "providers",
    "state_rules", "badges", "documents", "moving_plans",
    "audit_logs", "admin_users", "settings",
  ];

  for (const resource of resources) {
    await prisma.adminPermission.upsert({
      where: {
        adminUserId_resource: {
          adminUserId: admin.id,
          resource,
        },
      },
      update: {},
      create: {
        adminUserId: admin.id,
        resource,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    });
  }

  console.log(`  ✓ ${resources.length} permissions assigned`);
  console.log("✅ Admin seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
