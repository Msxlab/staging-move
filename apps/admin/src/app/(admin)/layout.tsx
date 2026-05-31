import { AuroraBackground } from "@/components/aurora";
import { Sidebar } from "@/components/sidebar";
import { SubNav } from "@/components/sub-nav";
import { CommandPalette } from "@/components/command-palette";
import { requirePageAdmin } from "@/lib/page-guard";
import "../aurora.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side resolve role + permission map. Sidebar receives only
  // the role and permission booleans; nothing else from the session.
  // requirePageAdmin redirects unauthenticated requests to /login.
  const ctx = await requirePageAdmin();

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
      <Sidebar ctx={{ role: ctx.role, permissions: ctx.permissions, email: ctx.email }} />
      {/* Global ⌘K / Ctrl+K command palette — instant nav + quick actions +
          user/provider search. Renders nothing until invoked. */}
      <CommandPalette ctx={{ role: ctx.role, permissions: ctx.permissions }} />
      <main
        id="admin-main"
        tabIndex={-1}
        className="flex-1 pl-64 focus:outline-none"
      >
        <div className="p-8">
          {/* Section tab bar — surfaces the sub-workflows that were removed
              from the sidebar (Billing, Governance, Reports, …). Renders only
              inside a cluster, role-gated by the same ctx as the sidebar. */}
          <SubNav ctx={{ role: ctx.role, permissions: ctx.permissions }} />
          {children}
        </div>
      </main>
    </div>
  );
}
