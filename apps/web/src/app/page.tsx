import type { Metadata } from "next";
import Link from "next/link";
import { getUserSession } from "@/lib/user-auth";
import {
  Home,
  MapPin,
  Truck,
  DollarSign,
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  ChevronDown,
  Star,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, absoluteUrl } from "@/lib/seo";

type MarketingPlan = {
  id: "FREE_TRIAL" | "INDIVIDUAL";
  displayName: string;
  priceLabel: string;
  periodLabel: string;
  isPaid: boolean;
  marketingFeatures: string[];
};

const SUBSCRIPTION_PLAN_ORDER: MarketingPlan["id"][] = ["FREE_TRIAL", "INDIVIDUAL"];

const SUBSCRIPTION_PLANS: Record<MarketingPlan["id"], MarketingPlan> = {
  FREE_TRIAL: {
    id: "FREE_TRIAL",
    displayName: "Free Trial",
    priceLabel: "Free",
    periodLabel: "7 days",
    isPaid: false,
    marketingFeatures: ["Up to 2 addresses", "Up to 10 services", "Basic moving checklist"],
  },
  INDIVIDUAL: {
    id: "INDIVIDUAL",
    displayName: "Individual",
    priceLabel: "$4.99",
    periodLabel: "/month",
    isPaid: true,
    marketingFeatures: ["Up to 10 addresses", "Up to 100 services", "Full moving planner", "QR box tracking"],
  },
};

function getSubscriptionPlanDefinition(planId: MarketingPlan["id"]) {
  return SUBSCRIPTION_PLANS[planId];
}

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
        width: 512,
        height: 512,
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
  const secondaryLabel = userId ? "Open Dashboard" : "Get Started Free";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    offers: SUBSCRIPTION_PLAN_ORDER.map((planId) => {
      const plan = getSubscriptionPlanDefinition(planId);
      return {
        "@type": "Offer",
        name: plan.displayName,
        price: plan.isPaid ? plan.priceLabel.replace(/[^0-9.]/g, "") : "0",
        priceCurrency: "USD",
      };
    }),
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
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">LocateFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {userId ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="sm">Open App</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">Get Started Free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Smart Moving & Address Management
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Every Address.{" "}
            <span className="text-primary">Every Service.</span>{" "}
            One Place.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Track all your subscriptions, utilities, and services across multiple addresses.
            Get AI-powered assistance when you move. Never miss an address update again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={primaryHref}>
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                {userId ? "Go to Dashboard" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                See How It Works
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Free 7-day trial. No credit card required.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="container py-20 border-t">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Everything You Need to Manage Your Move</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From tracking utilities to packing boxes, LocateFlow handles every detail of your relocation.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: MapPin,
              title: "Address Management",
              description: "Track multiple addresses with full service histories. Home, work, vacation — all organized.",
            },
            {
              icon: Zap,
              title: "Service Tracking",
              description: "Monitor utilities, banks, insurance, subscriptions. Know exactly what's tied to each address.",
            },
            {
              icon: Truck,
              title: "Moving Assistant",
              description: "AI-generated checklists and timelines. State-specific tasks, deadlines, and reminders.",
            },
            {
              icon: DollarSign,
              title: "Budget Tracking",
              description: "See your monthly expenses across all services. Compare costs between locations.",
            },
            {
              icon: FileText,
              title: "Document Management",
              description: "Upload and OCR contracts, bills, and papers. Everything searchable and organized.",
            },
            {
              icon: Users,
              title: "Family Sharing",
              description: "Coordinate with family members. Shared addresses, delegated tasks, unified budget view.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-200"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/50 py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three simple steps to organize your move</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Add Your Addresses",
                description: "Enter your current and new address. We'll detect your state and customize your experience.",
              },
              {
                step: "2",
                title: "Track Your Services",
                description: "Add utilities, banks, insurance, and subscriptions. We'll suggest common ones for your area.",
              },
              {
                step: "3",
                title: "Plan Your Move",
                description: "Get a personalized timeline with tasks, reminders, and state-specific requirements.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-lg">Start free, upgrade when you need more</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {SUBSCRIPTION_PLAN_ORDER.map((planId) => {
            const plan = getSubscriptionPlanDefinition(planId);
            const isPopular = plan.id === "INDIVIDUAL";
            const subtitle = plan.id === "FREE_TRIAL"
              ? `Try it out for ${plan.periodLabel}`
              : "For personal use";

            return (
              <div key={plan.id} className={`rounded-xl ${isPopular ? "border-2 border-primary" : "border"} p-8 space-y-6 relative`}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{plan.displayName}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                </div>
                <div>
                  <span className="text-4xl font-bold">{plan.priceLabel === "Free" ? "$0" : plan.priceLabel}</span>
                  <span className="text-muted-foreground">{plan.priceLabel === "Free" ? "" : plan.periodLabel}</span>
                </div>
                <ul className="space-y-3 text-sm">
                  {plan.marketingFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={primaryHref} className="block">
                  <Button variant={isPopular ? "default" : "outline"} className="w-full">
                    {userId ? secondaryLabel : plan.id === "FREE_TRIAL" ? "Start Free Trial" : "Get Started"}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

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

      {/* FAQ */}
      <section id="faq" className="bg-muted/50 py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "Is there really a free trial?", a: "Yes! You get 7 days free with no credit card required. You can upgrade anytime to unlock unlimited features." },
              { q: "What happens to my data if I cancel?", a: "Your data remains available for 30 days after cancellation. You can export everything as CSV or PDF before that." },
              { q: "Can I share with my family?", a: "Absolutely! The Family plan supports up to 5 members with role-based permissions — Admin, Editor, or Viewer." },
              { q: "Which states are supported?", a: "LocateFlow supports all 50 US states with state-specific DMV rules, voter registration info, utility providers, and tax requirements." },
              { q: "Is my data secure?", a: "Yes. We use industry-standard encryption, and your data is never shared with third parties. You can request full data deletion at any time (GDPR compliant)." },
            ].map((faq) => (
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

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container text-center space-y-6">
          <Shield className="h-12 w-12 mx-auto opacity-80" />
          <h2 className="text-3xl font-bold">Ready to Simplify Your Move?</h2>
          <p className="text-lg opacity-80 max-w-xl mx-auto">
            Join thousands of people who use LocateFlow to manage their addresses and services.
          </p>
          <Link href={primaryHref}>
            <Button size="lg" variant="secondary" className="text-base px-8">
              {userId ? "Open Dashboard" : "Start Your Free Trial"}
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
                <Home className="h-5 w-5 text-primary" />
                <span className="font-semibold">LocateFlow</span>
              </div>
              <p className="text-sm text-muted-foreground">Smart relocation management for modern movers.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="#features" className="block hover:text-foreground transition">Features</Link>
                <Link href="#pricing" className="block hover:text-foreground transition">Pricing</Link>
                <Link href="#how-it-works" className="block hover:text-foreground transition">How It Works</Link>
                <Link href="#faq" className="block hover:text-foreground transition">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Legal</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/privacy" className="block hover:text-foreground transition">Privacy Policy</Link>
                <Link href="/terms" className="block hover:text-foreground transition">Terms of Service</Link>
                <Link href="/cookie-policy" className="block hover:text-foreground transition">Cookie Policy</Link>
                <Link href="/disclaimer" className="block hover:text-foreground transition">Disclaimer</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/help" className="block hover:text-foreground transition">Help Center</Link>
                <Link href="#faq" className="block hover:text-foreground transition">FAQ</Link>
                <Link href="/contact" className="block hover:text-foreground transition">Contact Us</Link>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} LocateFlow. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">Made with care for movers everywhere</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
