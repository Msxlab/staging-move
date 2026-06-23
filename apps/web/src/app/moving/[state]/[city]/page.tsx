/**
 * Public /moving/<state>/<city> — per-METRO relocation guide. Higher-intent
 * than the state pages: someone searching "moving to Austin" is further down
 * the funnel than "moving to Texas".
 *
 * Honesty constraints (see lib/states/metros.ts):
 *   - Cities are REAL metros, curated by hand for the largest states only.
 *   - We invent NO city-specific legal data. Each page INHERITS the parent
 *     state's verbatim seed rules + provider list and presents them as
 *     "statewide rules apply in {City}". The only city-level copy is neutral,
 *     evergreen relocation framing (the metro blurb) — nothing fabricated.
 *
 * Rendering mirrors the state page: dynamic per request (for the per-request
 * CSP nonce — see the note below), but with a curated slug set.
 * `generateStaticParams` enumerates every curated [state, city] pair and
 * `dynamicParams = false` makes any other pair a hard 404. Each page emits
 * Article + FAQPage + BreadcrumbList JSON-LD, a self-canonical + en-US/x-default
 * hreflang, and OpenGraph/Twitter cards.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  ExternalLink,
  FileText,
  Landmark,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Truck,
  Vote,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import {
  JsonLd,
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
} from "@/components/seo/json-ld";
import { SITE_URL, absoluteUrl, publicMetadataTitle, SITE_NAME } from "@/lib/seo";
import type { StateGuide } from "@/lib/states/data";
import {
  METRO_SLUG_PAIRS,
  getMetroGuide,
  siblingMetros,
  type MetroGuide,
} from "@/lib/states/metros";

// Dynamic render (like every other marketing page) so the per-request CSP
// nonce that middleware sets matches the nonce baked into this response's
// inline/bootstrap scripts. Under `force-static` the prerendered HTML carried
// no per-request nonce, so the production `script-src 'nonce-X' 'strict-dynamic'`
// CSP blocked every script on these metro pages — breaking hydration and the
// cookie-consent banner. `dynamicParams = false` + `generateStaticParams` still
// pin the route to the curated metro set, so unknown slugs hard-404 as before.
export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ state: string; city: string }> {
  return METRO_SLUG_PAIRS;
}

function pagePath(stateSlug: string, citySlug: string): string {
  return `/moving/${stateSlug}/${citySlug}`;
}

function statePath(stateSlug: string): string {
  return `/moving/${stateSlug}`;
}

function metaDescription(metro: MetroGuide): string {
  const state = metro.state;
  const top = state.providers
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
  return `Moving to ${metro.name}, ${state.name}? A practical relocation guide: the statewide driver's license & vehicle deadlines, voter registration, top local utilities (${top}), taxes, auto-insurance minimums, and a step-by-step checklist for your move.`;
}

/** FAQ entries derived from the SAME inherited state seed fields the page
 *  renders, framed for the city so copy and rich result never disagree. Every
 *  rules answer is explicit that the requirement is statewide. */
function buildFaq(metro: MetroGuide): Array<{ question: string; answer: string }> {
  const state = metro.state;
  const providerNames = state.providers.map((p) => p.name).join(", ");
  return [
    {
      question: `How long do I have to get a driver's license after moving to ${metro.name}?`,
      answer: `${metro.name} follows ${state.name} state rules: ${state.dmvRules}`,
    },
    {
      question: `How do I register to vote in ${metro.name}, ${state.abbr}?`,
      answer: `Voter registration in ${metro.name} is handled at the ${state.name} state level: ${state.voterRegistration}`,
    },
    {
      question: `Which utility and internet providers serve ${metro.name}?`,
      answer: `Common providers across ${state.name}, including the ${metro.name} area, are ${providerNames}. ${state.utilityInfo} Coverage varies block to block — always confirm service availability at your exact ${metro.name} address with the provider before relying on it.`,
    },
    {
      question: `What are the taxes like in ${metro.name}?`,
      answer: `${metro.name} is subject to ${state.name} state taxes: ${state.taxInfo} Some metros add local sales or wage taxes, so confirm the rate for your specific address.`,
    },
    {
      question: `What is the minimum auto insurance for ${metro.name} drivers?`,
      answer: `${metro.name} drivers follow the ${state.name} statewide minimum: ${state.insuranceRules} These are statutory minimums and may not be enough coverage — confirm current requirements with your insurer or the state.`,
    },
  ];
}

const CHECKLIST: Array<{ label: string; detail: string }> = [
  {
    label: "Update your address",
    detail:
      "File a change of address with USPS, then your bank, employer, insurer, and any subscription tied to your old address.",
  },
  {
    label: "Set up utilities at the new place",
    detail:
      "Start electric, gas, water, internet, and trash before move-in day. Confirm availability at your exact address — coverage varies block to block.",
  },
  {
    label: "Get your new driver's license",
    detail:
      "Visit a state licensing office within the statewide deadline below. Bring proof of residency, identity, and your current license.",
  },
  {
    label: "Register your vehicle",
    detail:
      "Title and register your car, and check whether an emissions or safety inspection is required in your county.",
  },
  {
    label: "Register to vote",
    detail:
      "Update your voter registration at your new address so you stay eligible in your new precinct.",
  },
  {
    label: "Review insurance & taxes",
    detail:
      "Update auto and renters/home insurance to meet the state minimums, and note any state or local income, sales, or property tax differences.",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const metro = getMetroGuide(state, city);
  if (!metro) {
    return { title: "City not found", robots: { index: false, follow: false } };
  }

  const path = pagePath(metro.state.slug, metro.slug);
  const canonicalUrl = absoluteUrl(path);
  const title = `Moving to ${metro.name}, ${metro.state.abbr}: Relocation Guide & Checklist`;
  const description = metaDescription(metro);
  const socialTitle = publicMetadataTitle(title);
  const ogImage = absoluteUrl("/opengraph-image");

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        "en-US": canonicalUrl,
        "x-default": canonicalUrl,
      },
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: `Moving to ${metro.name}, ${metro.state.name}` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImage],
    },
  };
}

export default async function MovingCityPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const metro = getMetroGuide(state, city);
  if (!metro) notFound();

  const guide: StateGuide = metro.state;
  const path = pagePath(guide.slug, metro.slug);
  const url = absoluteUrl(path);
  const stateUrl = absoluteUrl(statePath(guide.slug));
  const faq = buildFaq(metro);
  const siblings = siblingMetros(guide.slug, metro.slug);
  const ctx = {
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    logoUrl: `${SITE_URL}/logo.svg`,
  };
  const lastModified = "2026-05-06T00:00:00.000Z";

  const ruleCards: Array<{ icon: typeof Car; title: string; body: string }> = [
    { icon: Car, title: "Driver's license & vehicle", body: guide.dmvRules },
    { icon: Vote, title: "Voter registration", body: guide.voterRegistration },
    { icon: Zap, title: "Utilities & energy market", body: guide.utilityInfo },
    { icon: ReceiptText, title: "Taxes", body: guide.taxInfo },
    { icon: ShieldCheck, title: "Auto insurance", body: guide.insuranceRules },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <JsonLd
        id="ld-article"
        data={articleSchema(ctx, {
          url,
          headline: `Moving to ${metro.name}, ${guide.name}: Relocation Guide & Checklist`,
          description: metaDescription(metro),
          image: absoluteUrl("/opengraph-image"),
          datePublished: lastModified,
          dateModified: lastModified,
          authorName: SITE_NAME,
          inLanguage: "en-US",
          keywords: [
            `moving to ${metro.name}`,
            `moving to ${metro.name} ${guide.abbr}`,
            `${metro.name} DMV`,
            `${metro.name} utilities`,
            `${metro.name} relocation checklist`,
            "change of address",
          ],
          articleSection: "Moving Guides",
        })}
      />
      <JsonLd id="ld-faq" data={faqPageSchema(faq)} />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Moving Guides", url: `${SITE_URL}/moving` },
          { name: guide.name, url: stateUrl },
          { name: metro.name, url },
        ])}
      />

      <main>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border bg-card/80 p-8 shadow-sm backdrop-blur sm:p-10">
            <nav
              className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="transition hover:text-primary">
                Home
              </Link>
              <span aria-hidden="true">·</span>
              <span className="text-foreground/80">Moving guides</span>
              <span aria-hidden="true">·</span>
              <Link href={statePath(guide.slug)} className="transition hover:text-primary">
                {guide.name}
              </Link>
              <span aria-hidden="true">·</span>
              <span className="text-primary/80">{metro.name}</span>
            </nav>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {metro.name}, {guide.abbr}
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Moving to {metro.name}, {guide.name}
                </h1>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  {metro.blurb} This is a practical, plain-English relocation guide for {metro.name}.
                  The deadlines that matter on arrival — driver&apos;s license, vehicle registration,
                  and voter registration — are set at the {guide.name} state level and apply
                  statewide in {metro.name}. Below you&apos;ll find those rules, the top local
                  utilities, the tax and insurance landscape, and a checklist you can work through in
                  order.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/sign-up">
                      Build my {metro.name} move plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href={statePath(guide.slug)}>
                      See the {guide.name} guide
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="shrink-0 self-center sm:self-start" aria-hidden="true">
                <RaccoonReading size={150} className="text-muted-foreground" />
              </div>
            </div>
          </section>

          {/* Statewide rules — clearly labeled as inherited */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {guide.name} rules &amp; deadlines that apply in {metro.name}
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              These requirements are set statewide in {guide.name} and apply in {metro.name}. Pulled
              from our state-rules reference — requirements change, so confirm with the state agency
              or provider before acting. {metro.name} or its county may add local steps (for example,
              emissions testing or a local wage tax) on top of these.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {ruleCards.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-background/60 p-5">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Top local providers (inherited from state) */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Top utilities &amp; providers near {metro.name}
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The major utilities, internet, and service providers operating across {guide.name},
              including the {metro.name} area. Coverage varies by address — confirm availability at
              your new {metro.name} home before you sign up.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {guide.providers.map((provider) => (
                <li
                  key={provider.name}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-4 py-3"
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                    {provider.name}
                  </span>
                  {provider.url ? (
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline"
                    >
                      Official site
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Relocation checklist */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Your {metro.name} relocation checklist
              </h2>
            </div>
            <ol className="mt-5 space-y-4">
              {CHECKLIST.map((item, i) => (
                <li key={item.label} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/sign-up">
                  Turn this into a tracked checklist
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>

          {/* FAQ */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Moving to {metro.name}: FAQ
              </h2>
            </div>
            <dl className="mt-5 divide-y divide-border">
              {faq.map((item) => (
                <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                  <dt className="text-sm font-semibold text-foreground">{item.question}</dt>
                  <dd className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Internal links: state page + sibling metros */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-foreground">Keep planning your move</h2>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {guide.name} guides
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link
                      href={statePath(guide.slug)}
                      className="text-primary transition hover:underline"
                    >
                      Moving to {guide.name} (statewide guide)
                    </Link>
                  </li>
                  {siblings.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={pagePath(guide.slug, s.slug)}
                        className="text-primary transition hover:underline"
                      >
                        Moving to {s.name}, {guide.abbr}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Guides &amp; resources
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/blog" className="text-primary transition hover:underline">
                      Moving &amp; relocation articles on the blog
                    </Link>
                  </li>
                  <li>
                    <Link href="/how-it-works" className="text-primary transition hover:underline">
                      How LocateFlow organizes your move
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/provider-coverage"
                      className="text-primary transition hover:underline"
                    >
                      Provider coverage &amp; how matching works
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-primary transition hover:underline">
                      Plans &amp; pricing
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-3xl border bg-gradient-to-b from-primary/[0.06] to-transparent p-8 text-center shadow-sm sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              Try LocateFlow
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Keep every {metro.name} move task, provider, and deadline in one place.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              LocateFlow turns this guide into a checklist tied to your {metro.name} address, with
              reminders before each deadline. Trial length, renewal date, and price are shown before
              checkout.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="px-8">
                <Link href="/sign-up">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">
                  See pricing
                </Link>
              </Button>
            </div>
            <p className="mx-auto mt-5 flex max-w-xl items-start justify-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                Guidance reflects {guide.name} statewide context but requirements, local rules, and
                provider processes change. Verify each task with the provider or agency before
                acting. See the{" "}
                <Link href="/disclaimer" className="underline">
                  Disclaimer
                </Link>
                .
              </span>
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
