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
import { AppStoreCTA } from "@/components/marketing/app-store-cta";
import { MobileMockup } from "@/components/marketing/mobile-mockup";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

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

export default async function LandingPage() {
  const session = await getUserSession();
  const userId = session?.userId ?? null;
  const primaryHref = userId ? "/dashboard" : "/sign-up";
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MarketingHeader userId={userId} />

      {/* Hero Section */}
      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            {t("section_features_subtitle")}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {t("heroPrefix")}{" "}
            <span className="text-primary">{t("heroAccent")}</span>{" "}
            {t("heroSuffix")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("heroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
          <p className="text-sm text-muted-foreground">
            {t("trust_retention", { days: TRIAL_DURATION_DAYS })} · {t("noCreditCard")} · {t("cancelAnytime")}
          </p>
        </div>

        {/* Current-product scope strip */}
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-card/40 px-6 py-5 text-center sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold">Manual move tasks</p>
              <p className="text-xs text-muted-foreground mt-1">
                Track local workflow steps without external account automation.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Listed providers</p>
              <p className="text-xs text-muted-foreground mt-1">
                Provider data is directory guidance; confirm availability with the provider.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Web and mobile</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the same service, provider, and move-task model across devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
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

      <PricingSection ctaHref={primaryHref} ctaLabelLoggedIn={!!userId} />

      {/* Current workflow coverage */}
      <section className="container py-20 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Built for manual move coordination</h2>
          <p className="text-muted-foreground text-lg">
            LocateFlow helps you organize what to do; it does not contact providers for you.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              title: "Services to stop or start",
              text: "Track old-address and destination service work as local LocateFlow tasks.",
            },
            {
              title: "Address updates to record",
              text: "Keep a local checklist of account address updates without implying external account access.",
            },
            {
              title: "Provider availability to confirm",
              text: "Use listed provider guidance with caveats and confirm details with the provider.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-6 space-y-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
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
              Mobile companion
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Your service list in your pocket</h2>
            <p className="text-muted-foreground">
              Add services, providers, and move tasks on the go. Snap a bill,
              get a renewal nudge, and check your monthly spend without
              leaving the couch. iOS and Android availability depends on
              store release status.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                Same data as the web — addresses, services, providers in sync.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                Email and in-app reminders before auto-renew, ready to check off on any device.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                Document scanning for bills, receipts, and proof-of-address.
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
