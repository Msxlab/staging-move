import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Forbidden — Admin",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 text-center">
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Your admin role does not include access to this page. If you need access,
        ask a SUPER_ADMIN to grant the required permission.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
