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

  // Persist the SUPER_ADMIN default permission matrix. The runtime
  // `checkPermission` helper in apps/admin/src/lib/auth.ts short-
  // circuits SUPER_ADMIN to allow-all, but we still write rows so the
  // team UI shows a populated matrix and so demotion to a lower role
  // leaves no "missing rows" footgun.
  //
  // The resource list and matrix live in
  // apps/admin/src/lib/admin-permissions.ts. We inline them here
  // because the Prisma seed runs in a separate process without the
  // Next.js app's path aliases — keeping them in sync with that module
  // is a known maintenance cost. If the list grows, update both.
  // Mirror of ADMIN_RESOURCES in apps/admin/src/lib/admin-permissions.ts.
  // Kept in sync by tests/admin-permissions-seed-parity (see admin app).
  // If you add a resource here, also add it there.
  const adminResources = [
    "users", "subscriptions", "reviews", "providers",
    "state_rules", "badges", "documents", "moving_plans", "tickets",
    "audit_logs", "admin_users", "settings",
    "blog", "acquisition_campaigns", "connectors",
  ];

  for (const resource of adminResources) {
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

  console.log(`  ✓ ${adminResources.length} permissions assigned`);
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
