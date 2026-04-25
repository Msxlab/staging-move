import { Bell, Wifi, Battery, MapPin, Zap, Droplet, Tv, Shield, Plus, Search, Home, Wallet, ChevronRight } from "lucide-react";

const mockServices = [
  { icon: Zap, name: "ConEd Electric", provider: "Con Edison", due: "in 4 days", tone: "honey" },
  { icon: Wifi, name: "Spectrum Internet", provider: "Charter Spectrum", due: "in 12 days", tone: "slate" },
  { icon: Tv, name: "Netflix", provider: "Netflix Inc.", due: "Renews Mar 18", tone: "rose" },
  { icon: Droplet, name: "NYC Water", provider: "DEP", due: "Quarterly", tone: "sage" },
  { icon: Shield, name: "Lemonade Renters", provider: "Lemonade", due: "Annual · Aug", tone: "foil" },
] as const;

const toneClasses: Record<string, string> = {
  honey: "bg-warning/15 text-warning",
  slate: "bg-info/15 text-info",
  rose: "bg-primary/15 text-primary",
  sage: "bg-success/15 text-success",
  foil: "bg-secondary/40 text-secondary-foreground",
};

export function MobileMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* Soft glow behind the phone */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[64px] bg-gradient-to-br from-primary/20 via-transparent to-secondary/15 blur-2xl"
      />

      {/* Phone frame */}
      <div className="relative rounded-[44px] border border-border/80 bg-background p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[36px] border border-border/60 bg-card">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-card px-6 pt-3 pb-2 text-[10px] font-medium text-foreground/80">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-background" />
            <div className="flex items-center gap-1.5">
              <Wifi className="h-3 w-3" />
              <Battery className="h-3 w-3" />
            </div>
          </div>

          {/* App header */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">My address</p>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  221B Baker St · Apt 4
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-primary p-2 text-primary-foreground"
                aria-label="Add"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span>Search services…</span>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mx-5 mb-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center">
            <div>
              <p className="text-base font-bold text-foreground">12</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Services</p>
            </div>
            <div className="border-l border-r border-border/60">
              <p className="text-base font-bold text-warning">3</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Due soon</p>
            </div>
            <div>
              <p className="text-base font-bold text-success">$284</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">/ month</p>
            </div>
          </div>

          {/* Service list */}
          <div className="space-y-1.5 px-3 pb-2">
            {mockServices.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.name}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5"
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[service.tone]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{service.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{service.provider}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="whitespace-nowrap">{service.due}</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-around border-t border-border bg-card px-2 py-3">
            {[
              { icon: Home, label: "Home", active: true },
              { icon: MapPin, label: "Addresses" },
              { icon: Wallet, label: "Budget" },
              { icon: Bell, label: "Alerts" },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex flex-col items-center gap-0.5 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
