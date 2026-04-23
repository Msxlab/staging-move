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
  Star,
  Quote,
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
  UPCOMING_BILLING_PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
} from "@locateflow/shared";
import { LogoMark, Wordmark } from "@/components/marketing/logo";
import { LandingThemeToggle } from "@/components/marketing/landing-theme-toggle";
import { PricingSection } from "@/components/marketing/pricing-section";
import { AppStoreCTA } from "@/components/marketing/app-store-cta";

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
  const tCommon = await getTranslations("common");
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
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("section_features_title").split("—")[0].trim() || "Features"}
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {(await getTranslations("pricing"))("title").split(".")[0]}
            </Link>
            <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("section_how_title")}
            </Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-1 md:gap-2">
            <LandingThemeToggle />
            {userId ? (
              <>
                <Link href="/dashboard" className="hidden sm:block">
                  <Button variant="ghost" size="sm">{(await getTranslations("nav"))("dashboard")}</Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="sm">{(await getTranslations("nav"))("dashboard")}</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="hidden sm:block">
                  <Button variant="ghost" size="sm">{tCommon("signIn")}</Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">{t("heroCta")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
                {userId ? (await getTranslations("errors"))("goToDashboard") : t("heroCta")}
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

        {/* Social proof strip — placeholder numbers until live metrics land. */}
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 rounded-2xl border bg-card/40 px-6 py-5 text-center">
            <div>
              <p className="text-2xl font-bold tracking-tight">2,400+</p>
              <p className="text-xs text-muted-foreground mt-1">Moves organized</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">50</p>
              <p className="text-xs text-muted-foreground mt-1">US states supported</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">120k+</p>
              <p className="text-xs text-muted-foreground mt-1">Services tracked</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">4.8 ★</p>
              <p className="text-xs text-muted-foreground mt-1">Beta rating</p>
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

      {/* Testimonials */}
      <section className="container py-20 border-t">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Loved by Movers Everywhere</h2>
          <p className="text-muted-foreground text-lg">See what our users have to say</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: "Sarah M.", role: "Relocated from TX to CA", text: "LocateFlow saved me hours of work. I had 15+ services to transfer and the checklist kept me on track.", rating: 5 },
            { name: "James K.", role: "Military Family", text: "We move every 2-3 years. LocateFlow is the first tool that actually understands state-by-state requirements.", rating: 5 },
            { name: "Priya R.", role: "First-time Homeowner", text: "The budget tracking and document management made closing on our new home so much less stressful.", rating: 5 },
          ].map((t) => (
            <div key={t.name} className="rounded-xl border bg-card p-6 space-y-4">
              <Quote className="h-8 w-8 text-primary/20" />
              <p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p>
              <div className="flex items-center gap-0.5 mb-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — pulls directly from the pricing FAQ keys so the landing and
          pricing pages stay in sync when the copy is edited. */}
      {await (async () => {
        const tPricing = await getTranslations("pricing");
        const faqs = [
          { q: tPricing("faq_trial_q"), a: tPricing("faq_trial_a") },
          { q: tPricing("faq_cancel_q"), a: tPricing("faq_cancel_a") },
          { q: tPricing("faq_refund_q"), a: tPricing("faq_refund_a") },
          { q: tPricing("faq_data_q"), a: tPricing("faq_data_a") },
        ];
        return (
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
        );
      })()}

      {/* Mobile App CTA */}
      <section className="container py-20 border-t">
        <div className="grid md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Mobile apps — coming soon
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Your service list in your pocket</h2>
            <p className="text-muted-foreground">
              Snap a photo of a bill, add a service on the go, and get push
              reminders before a contract renews. iOS and Android apps are in
              closed beta — join the waitlist to be first in line.
            </p>
            <AppStoreCTA />
          </div>
          <div className="relative">
            <div className="aspect-[3/4] rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
              <LogoMark size={96} className="opacity-90" />
            </div>
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
              {userId ? (await getTranslations("errors"))("goToDashboard") : t("heroCta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LogoMark size={24} />
                <span className="font-semibold">LocateFlow</span>
              </div>
              <p className="text-sm text-muted-foreground">{tCommon("tagline")}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">{t("section_features_title").split(" ")[0]}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="#features" className="block hover:text-foreground transition">{t("section_features_title")}</Link>
                <Link href="#pricing" className="block hover:text-foreground transition">{(await getTranslations("pricing"))("title")}</Link>
                <Link href="/how-it-works" className="block hover:text-foreground transition">{t("section_how_title")}</Link>
                <Link href="/faq" className="block hover:text-foreground transition">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">{tCommon("privacy")} / {tCommon("terms")}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/privacy" className="block hover:text-foreground transition">{(await getTranslations("legal"))("privacy_title")}</Link>
                <Link href="/terms" className="block hover:text-foreground transition">{(await getTranslations("legal"))("terms_title")}</Link>
                <Link href="/cookie-policy" className="block hover:text-foreground transition">{(await getTranslations("legal"))("cookie_title")}</Link>
                <Link href="/disclaimer" className="block hover:text-foreground transition">{(await getTranslations("legal"))("disclaimer_title")}</Link>
                <Link href="/refund" className="block hover:text-foreground transition">Refund policy</Link>
                <Link href="/acceptable-use" className="block hover:text-foreground transition">Acceptable use</Link>
                <Link href="/dpa" className="block hover:text-foreground transition">DPA</Link>
                <Link href="/security" className="block hover:text-foreground transition">Security</Link>
                <Link href="/ccpa-privacy-notice" className="block hover:text-foreground transition">California privacy</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">{tCommon("help")}</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/help" className="block hover:text-foreground transition">{(await getTranslations("help"))("title")}</Link>
                <Link href="/faq" className="block hover:text-foreground transition">FAQ</Link>
                <Link href="/contact" className="block hover:text-foreground transition">{tCommon("contact")}</Link>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} LocateFlow. {tCommon("privacy")}.
            </p>
            <p className="text-xs text-muted-foreground">{t("footer_tagline")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
