/**
 * Public /moving/<state> — per-state relocation guide (51 pages: 50 states
 * + DC). This is a programmatic-SEO / GEO surface: one statically generated,
 * genuinely useful page per state built from the same authoritative seed data
 * the product itself ships (packages/db/prisma/seed-data/state-rules.ts), so
 * the content never drifts from what the app knows.
 *
 * Rendering: dynamic per request (see the `dynamic`/`force-dynamic` note below
 * — needed so each response carries the per-request CSP nonce). The slug set is
 * still curated: `generateStaticParams` enumerates all 51 slugs and
 * `dynamicParams = false` makes any other slug a hard 404. There is no
 * per-request DB work and no Prisma in the graph (the data module is generated
 * and Prisma-free on purpose). Each page emits Article + FAQPage +
 * BreadcrumbList JSON-LD via the shared factory, a self-canonical + en-US/
 * x-default hreflang, and OpenGraph/Twitter cards.
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
  howToSchema,
} from "@/components/seo/json-ld";
import { SITE_URL, absoluteUrl, publicMetadataTitle, SITE_NAME } from "@/lib/seo";
import {
  STATE_GUIDES,
  STATE_SLUGS,
  getStateGuide,
  type StateGuide,
} from "@/lib/states/data";
import { metrosForState } from "@/lib/states/metros";

// Dynamic render (like every other marketing page) so the per-request CSP
// nonce that middleware sets is the SAME nonce baked into this response's
// inline/bootstrap scripts. Under `force-static` the page was prerendered at
// build time with no per-request nonce, so the production `script-src 'nonce-X'
// 'strict-dynamic'` CSP blocked ALL scripts on these 51 state + metro pages —
// killing hydration, the theme/locale toggles, and the cookie-consent banner
// (hence GA). `dynamicParams = false` + `generateStaticParams` still pin the
// route to the curated slug set, so an unknown slug hard-404s exactly as before.
export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ state: string }> {
  return STATE_SLUGS.map((state) => ({ state }));
}

function pagePath(slug: string): string {
  return `/moving/${slug}`;
}

function metaDescription(guide: StateGuide): string {
  const top = guide.providers
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
  return `Moving to ${guide.name}? A practical relocation guide: driver's license & vehicle deadlines, voter registration, top local utilities (${top}), taxes, auto-insurance minimums, and a step-by-step checklist.`;
}

/** The five FAQ entries are derived from the same seed rule fields the page
 *  renders, so the FAQPage rich result and the on-page copy never disagree. */
function buildFaq(guide: StateGuide): Array<{ question: string; answer: string }> {
  const providerNames = guide.providers.map((p) => p.name).join(", ");
  return [
    {
      question: `How long do I have to get a ${guide.name} driver's license after moving?`,
      answer: guide.dmvRules,
    },
    {
      question: `How do I register to vote in ${guide.name}?`,
      answer: guide.voterRegistration,
    },
    {
      question: `Which utility and internet providers serve ${guide.name}?`,
      answer: `Common providers in ${guide.name} include ${providerNames}. ${guide.utilityInfo} Always confirm service availability at your exact address with the provider before relying on it.`,
    },
    {
      question: `What are the taxes like in ${guide.name}?`,
      answer: guide.taxInfo,
    },
    {
      question: `What is the minimum auto insurance in ${guide.name}?`,
      answer: `${guide.insuranceRules} These are statutory minimums and may not be enough coverage — confirm current requirements with your insurer or the state.`,
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
      "Visit the state licensing office within the deadline below. Bring proof of residency, identity, and your current license.",
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
      "Update auto and renters/home insurance to meet the state minimums, and note any state income, sales, or property tax differences.",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const guide = getStateGuide(state);
  if (!guide) {
    return { title: "State not found", robots: { index: false, follow: false } };
  }

  const path = pagePath(guide.slug);
  const canonicalUrl = absoluteUrl(path);
  const title = `Moving to ${guide.name}: Relocation Guide & Checklist`;
  const description = metaDescription(guide);
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Moving to ${guide.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImage],
    },
  };
}

/** Three nearby states (alphabetical neighbors) for an internal-link rail —
 *  cheap, deterministic, and keeps each page from dead-ending. */
function relatedStates(guide: StateGuide): StateGuide[] {
  const idx = STATE_GUIDES.findIndex((s) => s.slug === guide.slug);
  const out: StateGuide[] = [];
  for (let offset = 1; out.length < 4 && offset < STATE_GUIDES.length; offset++) {
    const before = STATE_GUIDES[idx - offset];
    const after = STATE_GUIDES[idx + offset];
    if (after) out.push(after);
    if (before && out.length < 4) out.push(before);
  }
  return out.slice(0, 4);
}

export default async function MovingStatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const guide = getStateGuide(state);
  if (!guide) notFound();

  const path = pagePath(guide.slug);
  const url = absoluteUrl(path);
  const faq = buildFaq(guide);
  const related = relatedStates(guide);
  const metros = metrosForState(guide.slug);
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
          headline: `Moving to ${guide.name}: Relocation Guide & Checklist`,
          description: metaDescription(guide),
          image: absoluteUrl("/opengraph-image"),
          datePublished: lastModified,
          dateModified: lastModified,
          authorName: SITE_NAME,
          inLanguage: "en-US",
          keywords: [
            `moving to ${guide.name}`,
            `${guide.name} DMV`,
            `${guide.name} utilities`,
            `${guide.name} relocation checklist`,
            "change of address",
          ],
          articleSection: "Moving Guides",
        })}
      />
      <JsonLd id="ld-faq" data={faqPageSchema(faq)} />
      {/* HowTo built from the SAME ordered CHECKLIST the page renders below, so
          the rich result mirrors the visible step-by-step list exactly. */}
      <JsonLd
        id="ld-howto"
        data={howToSchema({
          name: `${guide.name} relocation checklist: what to do after you move`,
          description: `A step-by-step relocation checklist for moving to ${guide.name}: change your address, set up utilities, get your license, register your vehicle and to vote, and review insurance and taxes.`,
          inLanguage: "en-US",
          steps: CHECKLIST.map((item) => ({
            name: item.label,
            text: item.detail,
          })),
        })}
      />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Moving Guides", url: `${SITE_URL}/moving` },
          { name: guide.name, url },
        ])}
      />

      <main>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border bg-card/80 p-8 shadow-sm backdrop-blur sm:p-10">
            <nav
              className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="transition hover:text-primary">
                Home
              </Link>
              <span aria-hidden="true">·</span>
              <span className="text-foreground/80">Moving guides</span>
              <span aria-hidden="true">·</span>
              <span className="text-primary/80">{guide.name}</span>
            </nav>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  Moving to {guide.abbr}
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Moving to {guide.name}
                </h1>
                <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  A practical, plain-English relocation guide for {guide.name}. Here are the
                  deadlines that actually matter on arrival — driver&apos;s license, vehicle
                  registration, and voter registration — plus the top local utilities, the tax
                  and insurance landscape, and a checklist you can work through in order.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/sign-up">
                      Build my {guide.name} move plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/how-it-works">
                      How it works
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="shrink-0 self-center sm:self-start" aria-hidden="true">
                <RaccoonReading size={150} className="text-muted-foreground" />
              </div>
            </div>
          </section>

          {/* Key state rules */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Key {guide.name} rules &amp; deadlines
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Pulled from our state-rules reference. Requirements change — confirm with the state
              agency or provider before acting.
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

          {/* Top local providers */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Top utilities &amp; providers in {guide.name}
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The major utilities, internet, and service providers serving {guide.name}. Coverage
              varies by address — confirm availability at your new home before you sign up.
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
                Your {guide.name} relocation checklist
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
                Moving to {guide.name}: FAQ
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

          {/* Popular metros — only for states with curated city pages. */}
          {metros.length > 0 ? (
            <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-semibold text-foreground">
                Moving to a {guide.name} city?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Metro-specific guides for the biggest {guide.name} cities. Each one inherits the
                statewide rules above and adds local relocation context.
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {metros.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`${pagePath(guide.slug)}/${m.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/40"
                    >
                      Moving to {m.name}
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Internal links: blog + neighbor states */}
          <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-foreground">Keep planning your move</h2>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
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
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Other state guides
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {related.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={pagePath(s.slug)}
                        className="text-primary transition hover:underline"
                      >
                        Moving to {s.name}
                      </Link>
                    </li>
                  ))}
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
              Keep every {guide.name} move task, provider, and deadline in one place.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              LocateFlow turns this guide into a checklist tied to your address, with reminders
              before each deadline. Trial length, renewal date, and price are shown before
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
                Guidance includes US state and DC context but requirements and provider processes
                change. Verify each task with the provider or agency before acting. See the{" "}
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
