import Link from "next/link";
import { FileQuestion } from "lucide-react";

/** Admin 404. Without this, unmatched admin routes show Next.js's raw default. */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-12 text-center">
      <FileQuestion className="mb-4 h-16 w-16 text-muted-foreground/40" />
      <h2 className="mb-2 text-2xl font-semibold text-foreground">404 — Page not found</h2>
      <p className="mb-6 max-w-sm text-muted-foreground">
        This admin page doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
