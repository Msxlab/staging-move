import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ForcePasswordChangeClient from "./force-password-change-client";

// Forced first-login rotation for an AUTHENTICATED admin still flagged
// mustChangePassword. Lives OUTSIDE the (admin) route group so it is not
// caught by the page-guard's "redirect must-change admins here" rule (which
// would loop). The middleware allows this path during rotation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a new password — Admin",
  robots: { index: false, follow: false },
};

export default async function ForcePasswordChangePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { isActive: true, mustChangePassword: true, email: true },
  });
  if (!admin || !admin.isActive) {
    redirect("/login");
  }
  // Already rotated (e.g. opened the page in a second tab after finishing) —
  // send them to the dashboard instead of showing a dead form.
  if (admin.mustChangePassword !== true) {
    redirect("/");
  }

  return <ForcePasswordChangeClient email={admin.email} />;
}
