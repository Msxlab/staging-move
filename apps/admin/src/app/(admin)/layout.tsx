import { AuroraBackground } from "@/components/aurora";
import { Sidebar } from "@/components/sidebar";
import { SubNav } from "@/components/sub-nav";
import { Topbar } from "@/components/topbar";
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
    <div className="adm-aurora flex min-h-screen bg-background text-foreground">
      {/* Animated northern-lights background, pinned to viewport behind
          everything. Honors prefers-reduced-motion and goes calm when
          data-mode="lite" is set on the wrapper. Carries the design's
          navy → deep-navy operations gradient (text-primary = the gold). */}
      <AuroraBackground />

      {/* Skip-link — admin sidebar has 5 nav groups × ~4 links. Without
          this, keyboard users tab through every link on every page
          load. Visible only on focus (Tailwind `sr-only` +
          `focus:not-sr-only`). */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      {/* Left column — the design's 250px operations sidebar (grouped nav +
          Raccoon mark + identity footer). Mount + ctx preserved verbatim. */}
      <Sidebar ctx={{ role: ctx.role, permissions: ctx.permissions, email: ctx.email }} />
      {/* Global ⌘K / Ctrl+K command palette — instant nav + quick actions +
          user/provider search. Renders nothing until invoked. */}
      <CommandPalette ctx={{ role: ctx.role, permissions: ctx.permissions }} />
      {/* Right column — main content area. Inherits the sidebar offset
          (lg:pl-64) so it sits flush against the rail, like the design's
          flex:1 main pane. */}
      <main
        id="admin-main"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col pb-24 focus:outline-none lg:pl-64 lg:pb-0"
      >
        {/* Sticky corporate topbar — breadcrumb, ⌘K search trigger, bell /
            help / identity cluster. Lives inside <main> so it inherits the
            sidebar offset (pl-64) and pins to the viewport top while the
            page content scrolls beneath it. Mirrors the design's translucent
            blurred header strip. */}
        <Topbar ctx={{ role: ctx.role, permissions: ctx.permissions, email: ctx.email }} />
        {/* Scrolling work surface — the design's flex:1 content pane below the
            header. The .admin-workspace class carries the navy gradient +
            blueprint grid texture and the section padding; the inner wrapper
            centers content at a max width. */}
        <div className="admin-workspace flex-1">
          <div className="admin-workspace-inner">
          {/* Section tab bar — surfaces the sub-workflows that were removed
              from the sidebar (Billing, Governance, Reports, …). Renders only
              inside a cluster, role-gated by the same ctx as the sidebar. */}
            <SubNav ctx={{ role: ctx.role, permissions: ctx.permissions }} />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
