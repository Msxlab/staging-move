import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Forbidden — Admin",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        403 · Forbidden
      </p>
      <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight text-foreground">
        Access denied
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your admin role does not include access to this page. If you need access,
        ask a SUPER_ADMIN to grant the required permission.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
