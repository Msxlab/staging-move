import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUserSession } from "@/lib/user-auth";
import { isWorkspaceModelEnabled } from "@/lib/workspace-context";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
import {
  MapPin,
  Zap,
  DollarSign,
  FileText,
  Truck,
  Bell,
  CheckCircle2,
  ArrowRight,
  Home,
  Shield,
  ChevronDown,
  Scale,
  Receipt,
  Building2,
  Stethoscope,
  Package,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo";
import {
  BILLING_PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
  CONSUMER_FREE_FLAG,
} from "@locateflow/shared";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PricingSection } from "@/components/marketing/pricing-section";
import { resolveMarketingCtaTarget } from "@/lib/marketing-cta";
import { getPublicSubscriptionOffersViewModel } from "@/lib/acquisition-campaigns";
import { AppStoreCTA } from "@/components/marketing/app-store-cta";
import { MobileMockup } from "@/components/marketing/mobile-mockup";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { LatestBlogPosts } from "@/components/marketing/latest-blog-posts";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { HeroPhoneShowcase } from "@/components/marketing/hero-phone-showcase";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import { RecognitionChipStorm } from "@/components/marketing/recognition-chip-storm";
import { HardStats } from "@/components/marketing/hard-stats";
import { MovingMomentMock } from "@/components/marketing/moving-moment-mock";
import { DossierShowcase } from "@/components/marketing/dossier-showcase";
import { BilingualShowcase } from "@/components/marketing/bilingual-showcase";
import { SocialProof } from "@/components/marketing/social-proof";
import { EarlyAccessCapture } from "@/components/marketing/early-access-capture";
import { JsonLd, faqPageSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getUserSession();
  const userId = session?.userId ?? null;
  // Hero CTA still routes logged-in users to the dashboard. The pricing
  // CTA below resolves a state-aware destination so eligible Free Access
  // users are not silently funnelled past the trial offer.
  const primaryHref = userId ? "/dashboard" : "/sign-up";
  const [ctaTarget, publicCampaign, workspaceModelEnabled, apiConnectorsEnabled, consumerFree] = await Promise.all([
    resolveMarketingCtaTarget(userId),
    getPublicSubscriptionOffersViewModel(),
    isWorkspaceModelEnabled(),
    isApiConnectorsEnabled(),
    isFeatureEnabled(CONSUMER_FREE_FLAG),
  ]);
  const individualPlan = BILLING_PLAN_DEFINITIONS.INDIVIDUAL;
  // Server-side translation — getTranslations resolves the locale from
  // the request config and returns a synchronous `t()`. The landing is
  // a server component so we never ship translations to the client.
  const t = await getTranslations("landing");
  const tErrors = await getTranslations("errors");
  const tPricing = await getTranslations("pricing");
  // CONSUMER_FREE: the trial/cancel/refund Q&As (also emitted as FAQ structured
  // data) are meaningless when everything is free — drop them under the flag.
  const billingFaqs = consumerFree
    ? []
    : [
        { q: tPricing("faq_trial_q"), a: tPricing("faq_trial_a") },
        { q: tPricing("faq_cancel_q"), a: tPricing("faq_cancel_a") },
        { q: tPricing("faq_refund_q"), a: tPricing("faq_refund_a") },
      ];
  const faqs = [
    ...billingFaqs,
    { q: tPricing("faq_data_q"), a: tPricing("faq_data_a") },
    // Product / privacy entries — expanded for SEO and to answer the
    // questions the marketing review flagged. The provider-account answer
    // is deliberately careful: per the legal posture, LocateFlow does NOT
    // auto-update accounts. Keep this non-committal and flag-gated in spirit
    // even if connectors later ship behind FEATURE_API_CONNECTORS.
    {
      q: "Does LocateFlow update my provider accounts?",
      a: "No. LocateFlow does not log into or change your accounts with banks, utilities, government agencies, or any other provider on your behalf. What it does is help you track which services, subscriptions, and renewals are tied to each address, and guide you through the changes you need to make — with checklists, reminders, and links — so you can update each provider yourself through their official channel.",
    },
    {
      q: "What exactly does LocateFlow do?",
      a: "LocateFlow is an organizer for the chaos of moving and address changes. You keep your addresses, service providers, subscriptions, documents, and moving tasks in one place, and LocateFlow reminds you what still needs attention. It is an organizational and research aid — it does not act as a broker, agency, or provider, and it does not replace any of them.",
    },
    {
      q: "Will LocateFlow remind me before a service renews?",
      a: "Yes. You can record renewal and key dates for the services tied to your addresses, and LocateFlow sends reminders ahead of time so a subscription doesn't quietly renew against an old address or lapse when you need it. You decide what to act on — LocateFlow surfaces the timing, you make the change.",
    },
    {
      q: "Who can see my address and provider data?",
      a: "Your data is yours. Web analytics is consent-gated, access is protected with encryption in transit and access controls, and you can export or delete your data from settings at any time. Some billing, audit, legal, and security records may be retained when required. See our Privacy Policy for the full detail.",
    },
  ];
  const heroPrefix = "Your entire";
  const heroAccent = "move,";
  const heroSuffix = "handled.";
  const heroTitle = `${heroPrefix} ${heroAccent} ${heroSuffix}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}#software`,
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web, iOS, Android",
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}#organization` },
    // CONSUMER_FREE: advertise a single $0 offer (everything included) instead of
    // the paid Individual/Family/Pro tiers. Flag off (default) → unchanged.
    offers: consumerFree
      ? [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
          },
        ]
      : [
          {
            "@type": "Offer",
            name: BILLING_PLAN_DEFINITIONS.FREE_TRIAL.displayName,
            price: "0",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: `${individualPlan.displayName} Annual`,
            price: String(individualPlan.yearlyPriceUsd ?? 24),
            priceCurrency: "USD",
          },
          ...(individualPlan.monthlyPriceUsd
            ? [
                {
                  "@type": "Offer",
                  name: `${individualPlan.displayName} Monthly`,
                  price: String(individualPlan.monthlyPriceUsd),
                  priceCurrency: "USD",
                },
              ]
            : []),
        ],
  };

  return (
    <div className="min-h-screen bg-background">
      <JsonLd id="ld-home-software" data={structuredData} />
      <MarketingHeader userId={userId} />

      {/* Hero — source theme structure: relocation intelligence + interactive phone. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="aurora-blob pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="aurora-blob-2 pointer-events-none absolute -bottom-60 -left-40 h-[500px] w-[500px] rounded-full bg-tone-foil-bg blur-3xl"
        />
        <div className="container relative grid items-center gap-14 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
              Relocation Intelligence
            </div>
            <h1
              aria-label={heroTitle}
              className="display-tight font-display text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight"
            >
              <span aria-hidden="true">
                {heroPrefix} {heroAccent}{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-[length:200%_auto] bg-clip-text text-transparent motion-safe:animate-[foil-shimmer_5s_linear_infinite]">
                  {heroSuffix}
                </span>
              </span>
            </h1>
            <p className="measure text-lg md:text-xl text-foreground/90 leading-relaxed">
              LocateFlow tracks every utility, address and deadline, and briefs you on your new home before you arrive.
            </p>
            <p className="measure text-sm leading-6 text-recessive md:text-base">
              One countdown. Zero surprises. No spreadsheets, no sticky notes, no missed transfer windows.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto text-base px-8">
                <Link href={primaryHref}>
                  {userId ? tErrors("goToDashboard") : "Start your move - free"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                <Link href="/how-it-works">
                  See how it works
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                4.9 on the App Store
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                FEMA, EPA and NWS data
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Web, iOS and Android
              </span>
            </div>
          </div>

          {/* Interactive phone prototype ported from the theme handoff. */}
          <div className="relative">
            <HeroPhoneShowcase />
          </div>
        </div>

        {/* Scope strip — what the product actually does, in three quiet lines */}
        <div className="container">
          <div className="mx-auto mb-16 mt-2 max-w-4xl">
            <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-card/40 px-6 py-6 text-center backdrop-blur sm:grid-cols-3 sm:divide-x sm:divide-border">
              <div className="px-2">
                <p className="text-sm font-semibold">{t("scope_strip_manual_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scope_strip_manual_body")}
                </p>
              </div>
              <div className="px-2">
                <p className="text-sm font-semibold">{t("scope_strip_directory_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scope_strip_directory_body")}
                </p>
              </div>
              <div className="px-2">
                <p className="text-sm font-semibold">{t("scope_strip_devices_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scope_strip_devices_body")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recognition — the chip storm. Visceral expansion of the wound. */}
      <RecognitionChipStorm />

      {/* Hard stats — credibility, sourced. */}
      <HardStats />

      {/* Risk grid — what goes to your old address (existing) */}
      <section className="container py-20 border-t">
        <div className="text-center mb-14 max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-tone-foil-br bg-tone-foil-bg px-3 py-1 text-xs text-tone-foil-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-tone-foil-fg" />
            {t("risk_eyebrow")}
          </div>
          <h2 className="display-tight font-display text-3xl md:text-4xl font-bold">{t("risk_title")}</h2>
          <p className="text-recessive text-lg">{t("risk_subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
          {[
            { icon: Scale, titleKey: "risk_legal_title", bodyKey: "risk_legal_body" },
            { icon: Receipt, titleKey: "risk_finance_title", bodyKey: "risk_finance_body" },
            { icon: Building2, titleKey: "risk_govt_title", bodyKey: "risk_govt_body" },
            { icon: Stethoscope, titleKey: "risk_health_title", bodyKey: "risk_health_body" },
            { icon: Package, titleKey: "risk_daily_title", bodyKey: "risk_daily_body" },
          ].map((item) => (
            <div
              key={item.titleKey}
              className="rounded-2xl border bg-card p-5 space-y-3 hover:border-tone-foil-br hover:shadow-md transition-all"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-tone-foil-bg text-tone-foil-fg">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">{t(item.titleKey as any)}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Moving moment — first taste of relief. Checklist mock + pitch. */}
      <MovingMomentMock />

      {/* Features Grid — the full product reveal */}
      <section id="features" className="container py-20 border-t">
        <div className="text-center mb-16">
          <h2 className="display-tight font-display text-3xl md:text-4xl font-bold mb-4">{t("section_features_title")}</h2>
          <p className="text-recessive text-lg max-w-2xl mx-auto">
            {t("section_features_subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: MapPin, titleKey: "feature_services_title", bodyKey: "feature_services_body" },
            { icon: Home, titleKey: "feature_dossier_title", bodyKey: "feature_dossier_body" },
            { icon: Bell, titleKey: "feature_reminders_title", bodyKey: "feature_reminders_body" },
            { icon: DollarSign, titleKey: "feature_budget_title", bodyKey: "feature_budget_body" },
            { icon: FileText, titleKey: "feature_documents_title", bodyKey: "feature_documents_body" },
            { icon: Truck, titleKey: "feature_moving_title", bodyKey: "feature_moving_body" },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-2xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-200"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey as any)}</h3>
              <p className="text-muted-foreground text-sm">{t(feature.bodyKey as any)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New home dossier showcase — animated EXAMPLE report (sample data,
          clearly labelled) with the same data-driven ambient scenes as the
          dashboard card. Sits right after the features grid so it reads as
          the deep-dive on the dossier feature tile above; CTA goes to
          /pricing (Pro pitch). Client component, no data fetching. */}
      <DossierShowcase />

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/50 py-20">
        <div className="container">
          <div className="text-center mb-16">
            {/* Subtle mascot accent — the reading raccoon peeking over the
                steps, keeping the "Field Guide" character consistent with the
                blog. Decorative, token-themed, sits above the heading so it
                reads as a friendly guide, not clutter. */}
            <RaccoonReading
              size={104}
              className="mx-auto mb-4 text-foreground/35"
            />
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold mb-4">{t("section_how_title")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              { step: "1", titleKey: "step_1_title", bodyKey: "step_1_body" },
              { step: "2", titleKey: "step_2_title", bodyKey: "step_2_body" },
              { step: "3", titleKey: "step_3_title", bodyKey: "step_3_body" },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border bg-card p-7 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-primary/30 bg-primary/10 font-display text-2xl font-bold text-primary">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold">{t(item.titleKey as any)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Address sync (connectors). Gated by FEATURE_API_CONNECTORS so the live
          page is byte-identical until launch. DRAFT copy — before flipping the
          flag, legal must reconcile this with the "does not update provider
          accounts" disclaimers on /pricing, /about, and the moving page. Copy is
          deliberately conservative: per-partner authorization, on-your-behalf
          submission, disconnect anytime — no blanket "automatic everywhere". */}
      {apiConnectorsEnabled && (
        <section className="container py-20 border-t">
          <div className="text-center mb-12 max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Zap className="h-3.5 w-3.5" />
              {t("connector_eyebrow")}
            </div>
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold tracking-tight">{t("connector_title")}</h2>
            <p className="text-muted-foreground text-lg">{t("connector_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Shield, titleKey: "connector_feature_authorize_title", bodyKey: "connector_feature_authorize_body" },
              { icon: Zap, titleKey: "connector_feature_submit_title", bodyKey: "connector_feature_submit_body" },
              { icon: CheckCircle2, titleKey: "connector_feature_control_title", bodyKey: "connector_feature_control_body" },
            ].map((item) => (
              <div key={item.titleKey} className="rounded-2xl border bg-card p-6 space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{t(item.titleKey as any)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground max-w-2xl mx-auto">{t("connector_disclaimer")}</p>
        </section>
      )}

      {/* Families & teams — workspace positioning. Gated by WORKSPACE_MODEL_ENABLED
          so the live page is unchanged until launch. Copy is about shared
          workspaces only — it makes no auto-update/provider-account claim. */}
      {workspaceModelEnabled && (
        <section className="container py-20 border-t">
          <div className="text-center mb-12 max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Users className="h-3.5 w-3.5" />
              {t("family_eyebrow")}
            </div>
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold tracking-tight">{t("family_title")}</h2>
            <p className="text-muted-foreground text-lg">{t("family_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Users, titleKey: "family_feature_invite_title", bodyKey: "family_feature_invite_body" },
              { icon: Shield, titleKey: "family_feature_roles_title", bodyKey: "family_feature_roles_body" },
              { icon: MapPin, titleKey: "family_feature_together_title", bodyKey: "family_feature_together_body" },
            ].map((item) => (
              <div key={item.titleKey} className="rounded-2xl border bg-card p-6 space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{t(item.titleKey as any)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bilingual showcase — the wedge */}
      <BilingualShowcase />

      {/* Social proof — testimonial card wall. SAMPLE/placeholder content
          (see component) — owner must swap for real, attributable quotes. */}
      <SocialProof />

      {/* NOTE: The standalone <TestimonialQuote/> pull-quote was removed because
          it shipped a FABRICATED named-customer attribution ("Maria L · Moved 4
          times in 6 years") live and ungated — an FTC/endorsement risk. Mirroring
          the gated SocialProof above, no fake named testimonial may render on the
          live home page. Re-add only with a real, consented, attributable quote. */}

      <PricingSection
        ctaHref={ctaTarget.href}
        ctaLabelLoggedIn={!!userId}
        ctaIntent={ctaTarget.intent}
        offers={publicCampaign}
        consumerFree={consumerFree}
      />

      {/* Latest blog posts — server component, ISR-cached. Renders
          nothing if the blog hasn't published anything yet. */}
      <LatestBlogPosts />

      {/* Current workflow coverage */}
      <section className="container py-20 border-t">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="display-tight font-display text-3xl md:text-4xl font-bold mb-4">{t("scope_title")}</h2>
          <p className="text-recessive text-lg">{t("scope_subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { titleKey: "scope_track_title", bodyKey: "scope_track_body" },
            { titleKey: "scope_provider_title", bodyKey: "scope_provider_body" },
            { titleKey: "scope_devices_title", bodyKey: "scope_devices_body" },
          ].map((item) => (
            <div key={item.titleKey} className="rounded-2xl border bg-card p-6 space-y-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
              <h3 className="text-base font-semibold">{t(item.titleKey as any)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ - pulls the billing keys from the pricing FAQ so landing and
          pricing stay in sync, plus product/privacy entries defined above.
          Emits FAQPage structured data so the Q&A is eligible for rich
          results in search. */}
      <section id="faq" className="bg-muted/50 py-20">
        <JsonLd
          id="ld-home-faq"
          data={faqPageSchema(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))}
        />
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold mb-4">{tPricing("faq_title")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-2xl border bg-card">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Email capture — early access / newsletter. Reuses the existing
          WaitlistForm + /api/waitlist endpoint (source: home-early-access). */}
      <EarlyAccessCapture />

      {/* Mobile App CTA */}
      <section className="container py-20 border-t">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
              {t("mobile_eyebrow")}
            </div>
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold tracking-tight">{t("mobile_title")}</h2>
            <p className="text-muted-foreground">{t("mobile_body")}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                {t("mobile_bullet_1")}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                {t("mobile_bullet_2")}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                {t("mobile_bullet_3")}
              </li>
            </ul>
            <AppStoreCTA />
          </div>
          <div className="relative flex justify-center">
            <MobileMockup />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_60%)]"
          />
          <div className="relative space-y-6">
            <Shield className="h-12 w-12 mx-auto opacity-80" />
            <h2 className="display-tight font-display text-3xl md:text-4xl font-bold">{t("section_trust_title")}</h2>
            <p className="text-lg opacity-80 max-w-xl mx-auto">
              {t("trust_retention")} · {t("noCreditCard")}
            </p>
            <Button asChild size="lg" variant="secondary" className="text-base px-8">
              <Link href={primaryHref}>
                {userId ? tErrors("goToDashboard") : t("heroCta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
