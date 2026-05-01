import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUserSession } from "@/lib/user-auth";
import {
  MapPin,
  Zap,
  DollarSign,
  FileText,
  Truck,
  Bell,
  CheckCircle2,
  ArrowRight,
  Shield,
  ChevronDown,
  Scale,
  Receipt,
  Building2,
  Stethoscope,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  absoluteUrl,
} from "@/lib/seo";
import {
  BILLING_PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
} from "@locateflow/shared";
import { PricingSection } from "@/components/marketing/pricing-section";
import { resolveMarketingCtaTarget } from "@/lib/marketing-cta";
import { getPublicSubscriptionOffersViewModel } from "@/lib/acquisition-campaigns";
import { AppStoreCTA } from "@/components/marketing/app-store-cta";
import { MobileMockup } from "@/components/marketing/mobile-mockup";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { LatestBlogPosts } from "@/components/marketing/latest-blog-posts";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { HeroPhoneMock } from "@/components/marketing/hero-phone-mock";
import { RecognitionChipStorm } from "@/components/marketing/recognition-chip-storm";
import { HardStats } from "@/components/marketing/hard-stats";
import { MovingMomentMock } from "@/components/marketing/moving-moment-mock";
import { BilingualShowcase } from "@/components/marketing/bilingual-showcase";
import { TestimonialQuote } from "@/components/marketing/testimonial-quote";
import { JsonLd } from "@/components/seo/json-ld";

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

export const revalidate = 60;

export default async function LandingPage() {
  const session = await getUserSession();
  const userId = session?.userId ?? null;
  // Hero CTA still routes logged-in users to the dashboard. The pricing
  // CTA below resolves a state-aware destination so eligible Free Access
  // users are not silently funnelled past the trial offer.
  const primaryHref = userId ? "/dashboard" : "/sign-up";
  const [ctaTarget, publicCampaign] = await Promise.all([
    resolveMarketingCtaTarget(userId),
    getPublicSubscriptionOffersViewModel(),
  ]);
  const individualPlan = BILLING_PLAN_DEFINITIONS.INDIVIDUAL;
  // Server-side translation — getTranslations resolves the locale from
  // the request config and returns a synchronous `t()`. The landing is
  // a server component so we never ship translations to the client.
  const t = await getTranslations("landing");
  const tErrors = await getTranslations("errors");
  const tPricing = await getTranslations("pricing");
  const faqs = [
    { q: tPricing("faq_trial_q"), a: tPricing("faq_trial_a") },
    { q: tPricing("faq_cancel_q"), a: tPricing("faq_cancel_a") },
    { q: tPricing("faq_refund_q"), a: tPricing("faq_refund_a") },
    { q: tPricing("faq_data_q"), a: tPricing("faq_data_a") },
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    offers: [
      {
        "@type": "Offer",
        name: BILLING_PLAN_DEFINITIONS.FREE_TRIAL.displayName,
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: individualPlan.displayName,
        price: String(individualPlan.monthlyPriceUsd),
        priceCurrency: "USD",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <JsonLd id="ld-home-software" data={structuredData} />
      <MarketingHeader userId={userId} />

      {/* Hero — text left, phone mock right (md+). The phone is the wound *and*
          the relief in one frame: real spend, real savings, two real attention items. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-60 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-3xl"
        />
        <div className="container relative grid items-center gap-14 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-primary">
              <Zap className="h-3.5 w-3.5" />
              {t("hero_eyebrow")}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.98]">
              {t("heroPrefix")}{" "}
              <span className="text-primary">{t("heroAccent")}</span>{" "}
              {t("heroSuffix")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-[36ch] leading-relaxed">
              {t("heroDescription")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={primaryHref}>
                <Button size="lg" className="w-full sm:w-auto text-base px-8">
                  {userId ? tErrors("goToDashboard") : t("heroCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                  {t("heroSecondary")}
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                {t("noCreditCard")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                {t("cancelAnytime")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" />
                {t("trust_gdpr")}
              </span>
            </div>
          </div>

          <div className="relative">
            <HeroPhoneMock />
          </div>
        </div>

        {/* Scope strip — what the product actually does, in three quiet lines */}
        <div className="container">
          <div className="mx-auto mb-16 mt-2 max-w-4xl">
            <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-card/40 px-6 py-5 text-center sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold">{t("scope_strip_manual_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scope_strip_manual_body")}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">{t("scope_strip_directory_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scope_strip_directory_body")}
                </p>
              </div>
              <div>
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
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1 text-xs text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t("risk_eyebrow")}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("risk_title")}</h2>
          <p className="text-muted-foreground text-lg">{t("risk_subtitle")}</p>
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
              className="rounded-xl border bg-card p-5 space-y-3 hover:border-amber-500/40 hover:shadow-md transition-all"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
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
          <h2 className="text-3xl font-bold mb-4">{t("section_features_title")}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("section_features_subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: MapPin, titleKey: "feature_services_title", bodyKey: "feature_services_body" },
            { icon: Zap, titleKey: "feature_community_title", bodyKey: "feature_community_body" },
            { icon: Bell, titleKey: "feature_reminders_title", bodyKey: "feature_reminders_body" },
            { icon: DollarSign, titleKey: "feature_budget_title", bodyKey: "feature_budget_body" },
            { icon: FileText, titleKey: "feature_documents_title", bodyKey: "feature_documents_body" },
            { icon: Truck, titleKey: "feature_moving_title", bodyKey: "feature_moving_body" },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-200"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey as any)}</h3>
              <p className="text-muted-foreground text-sm">{t(feature.bodyKey as any)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/50 py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t("section_how_title")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", titleKey: "step_1_title", bodyKey: "step_1_body" },
              { step: "2", titleKey: "step_2_title", bodyKey: "step_2_body" },
              { step: "3", titleKey: "step_3_title", bodyKey: "step_3_body" },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold">{t(item.titleKey as any)}</h3>
                <p className="text-sm text-muted-foreground">{t(item.bodyKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bilingual showcase — the wedge */}
      <BilingualShowcase />

      {/* Testimonial — emotional landing right before pricing */}
      <TestimonialQuote />

      <PricingSection
        ctaHref={ctaTarget.href}
        ctaLabelLoggedIn={!!userId}
        ctaIntent={ctaTarget.intent}
        offers={publicCampaign}
      />

      {/* Latest blog posts — server component, ISR-cached. Renders
          nothing if the blog hasn't published anything yet. */}
      <LatestBlogPosts />

      {/* Current workflow coverage */}
      <section className="container py-20 border-t">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">{t("scope_title")}</h2>
          <p className="text-muted-foreground text-lg">{t("scope_subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { titleKey: "scope_track_title", bodyKey: "scope_track_body" },
            { titleKey: "scope_provider_title", bodyKey: "scope_provider_body" },
            { titleKey: "scope_devices_title", bodyKey: "scope_devices_body" },
          ].map((item) => (
            <div key={item.titleKey} className="rounded-xl border bg-card p-6 space-y-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
              <h3 className="text-base font-semibold">{t(item.titleKey as any)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(item.bodyKey as any)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ - pulls directly from the pricing FAQ keys so the landing and
          pricing pages stay in sync when the copy is edited. */}
      <section id="faq" className="bg-muted/50 py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{tPricing("faq_title")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border bg-card">
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

      {/* Mobile App CTA */}
      <section className="container py-20 border-t">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {t("mobile_eyebrow")}
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{t("mobile_title")}</h2>
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
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container text-center space-y-6">
          <Shield className="h-12 w-12 mx-auto opacity-80" />
          <h2 className="text-3xl font-bold">{t("section_trust_title")}</h2>
          <p className="text-lg opacity-80 max-w-xl mx-auto">
            {t("trust_retention")} · {t("noCreditCard")}
          </p>
          <Link href={primaryHref}>
            <Button size="lg" variant="secondary" className="text-base px-8">
              {userId ? tErrors("goToDashboard") : t("heroCta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
