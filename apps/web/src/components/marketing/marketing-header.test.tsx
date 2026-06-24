import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next/link → plain anchor.
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname || "#"} {...props}>
      {children}
    </a>
  ),
}));

// next-intl/server getTranslations → identity-ish resolver keyed by namespace.key
// so we don't depend on the real catalog for this layout-contract test.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

// Heavy auth module (prisma / jose / bcrypt). We always pass userId explicitly,
// so getUserSession is never actually invoked — mock it to keep the chain light.
vi.mock("@/lib/user-auth", () => ({
  getUserSession: async () => null,
}));

// Child components — render simple sentinels so we can assert presence/structure.
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock("@/components/marketing/landing-theme-toggle", () => ({
  LandingThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/components/marketing/logo", () => ({
  Wordmark: () => <div data-testid="wordmark" />,
}));
vi.mock("@/components/language-selector", () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));
vi.mock("@/components/marketing/marketing-user-menu", () => ({
  MarketingUserMenu: () => <div data-testid="user-menu" />,
}));
vi.mock("@/components/marketing/marketing-mobile-nav", () => ({
  // The real mobile nav is `lg:hidden` and carries the auth CTAs below lg.
  MarketingMobileNav: () => <div data-testid="mobile-nav" className="lg:hidden" />,
}));

import { MarketingHeader } from "./marketing-header";

async function renderHeader(userId: string | null) {
  return renderToStaticMarkup(await MarketingHeader({ userId }));
}

describe("MarketingHeader (responsive auth group)", () => {
  it("hides the logged-out desktop auth CTAs below lg so they cannot overflow on mobile", async () => {
    const html = await renderHeader(null);

    // The Sign in / Get started pair must render (desktop entry point)...
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('href="/sign-up"');

    // ...but only inside a container that is hidden until lg. Without the
    // `hidden ... lg:flex` wrapper the group renders at all widths and the
    // header overflows 390px viewports (audit: doc width 495 > 390). This
    // assertion fails pre-fix because the pair was a bare fragment.
    const authGroup = html.match(/<div class="([^"]*\blg:flex\b[^"]*)">\s*<span[^>]*><a href="\/sign-in"/);
    expect(authGroup, "logged-out auth CTAs must be wrapped in an lg:flex container").not.toBeNull();
    const cls = authGroup![1];
    expect(cls).toContain("hidden");
    expect(cls).toContain("lg:flex");
  });

  it("keeps the mobile nav as the below-lg entry point (it owns the auth CTAs there)", async () => {
    const html = await renderHeader(null);
    // The mobile nav (lg:hidden) is always present and is the gate on mobile.
    expect(html).toContain('data-testid="mobile-nav"');
    expect(html).toContain("lg:hidden");
  });

  it("shows the account menu (no overflow-prone CTA pair) when logged in", async () => {
    const html = await renderHeader("u_123");
    expect(html).toContain('data-testid="user-menu"');
    // Logged-in header has no Sign in / Get started CTAs at all.
    expect(html).not.toContain('href="/sign-in"');
    expect(html).not.toContain('href="/sign-up"');
  });
});
