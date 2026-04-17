import { ArrowLeft, Check, Crown, Sparkles } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free Trial",
    price: "Free",
    period: "30 days",
    features: ["1 address", "Unlimited services", "5 documents (50MB)", "Basic moving checklist"],
    current: false,
    accent: "border-white/10",
  },
  {
    name: "Individual",
    price: "$4.99",
    period: "/month",
    yearlyPrice: "$49/year",
    features: ["Unlimited addresses", "Unlimited services", "500MB documents", "Full moving assistant", "QR box tracking", "Community reviews", "Badges & gamification"],
    current: true,
    accent: "border-orange-500/40 ring-1 ring-orange-500/20",
  },
  {
    name: "Family",
    price: "$7.99",
    period: "/month",
    yearlyPrice: "$79/year",
    features: ["Everything in Individual", "Up to 5 family members", "Shared addresses", "Role-based permissions", "1GB shared storage", "Family budget dashboard"],
    current: false,
    accent: "border-cyan-500/30",
  },
];

function LegacySubscriptionPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription</h1>
          <p className="text-sm text-white/40">Manage your plan and billing</p>
        </div>
      </div>

      {/* Current plan banner */}
      <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 backdrop-blur-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Crown className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <span className="font-medium text-white text-sm">Individual Plan</span>
            <span className="block text-xs text-white/40">Next billing: March 1, 2026</span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
          Active
        </span>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.name} className={`rounded-2xl border bg-white/5 backdrop-blur-xl overflow-hidden relative ${plan.accent}`}>
            {plan.current && (
              <div className="absolute top-3 right-3">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[9px] font-medium">
                  <Sparkles className="h-2.5 w-2.5" />Current
                </span>
              </div>
            )}
            <div className="p-5 pb-3">
              <h3 className="text-base font-semibold text-white">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-white/40">{plan.period}</span>
              </div>
              {plan.yearlyPrice && (
                <span className="text-[11px] text-white/30 block mt-1">or {plan.yearlyPrice} (save 17%)</span>
              )}
            </div>
            <div className="px-5 pb-5 space-y-3">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <button disabled className="w-full py-2 rounded-xl border border-white/10 text-sm text-white/30 cursor-not-allowed">
                  Current Plan
                </button>
              ) : (
                <button className={`w-full py-2 rounded-xl text-sm font-medium transition ${
                  plan.name === "Family"
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-white/10 text-white/60 hover:bg-white/5"
                }`}>
                  {plan.name === "Free Trial" ? "Downgrade" : "Upgrade"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { default } from "@/components/settings/subscription-management";
