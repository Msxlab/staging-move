import { AuroraBackground } from "@/components/aurora";
import { Sidebar } from "@/components/sidebar";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import "../aurora.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login");
  }

  return (
    <div className="adm-aurora flex min-h-screen">
      {/* Animated northern-lights background, pinned to viewport behind
          everything. Honors prefers-reduced-motion and goes calm when
          data-mode="lite" is set on the wrapper. */}
      <AuroraBackground />

      {/* Skip-link — admin sidebar has 5 nav groups × ~4 links. Without
          this, keyboard users tab through every link on every page
          load. Visible only on focus (Tailwind `sr-only` +
          `focus:not-sr-only`). */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-brand-orange focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main
        id="admin-main"
        tabIndex={-1}
        className="flex-1 pl-64 focus:outline-none"
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
