"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  DollarSign,
  FileText,
  Home,
  MapPin,
  Palmtree,
  Search,
  Settings,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "address" | "service" | "page";
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
}

const pages: SearchResult[] = [
  { id: "p-dashboard", type: "page", title: "Dashboard", subtitle: "Overview & stats", href: "/dashboard", icon: Home },
  { id: "p-addresses", type: "page", title: "Addresses", subtitle: "Manage addresses", href: "/addresses", icon: MapPin },
  { id: "p-services", type: "page", title: "Services", subtitle: "Manage services", href: "/services", icon: Zap },
  { id: "p-moving", type: "page", title: "Moving Plans", subtitle: "Plan your move", href: "/moving", icon: Truck },
  { id: "p-settings", type: "page", title: "Settings", subtitle: "Account & preferences", href: "/settings", icon: Settings },
  { id: "p-budget", type: "page", title: "Budget", subtitle: "Track expenses", href: "/budget", icon: DollarSign },
  { id: "p-export", type: "page", title: "Export & Reports", subtitle: "Download PDF/CSV reports", href: "/settings/export", icon: FileText },
  { id: "p-add-address", type: "page", title: "Add Address", subtitle: "Register new address", href: "/addresses/new", icon: MapPin },
  { id: "p-add-service", type: "page", title: "Add Service", subtitle: "Register new service", href: "/services/new", icon: Zap },
];

const typeIcons: Record<string, React.ElementType> = {
  HOME: Home,
  WORK: Briefcase,
  VACATION: Palmtree,
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addresses, setAddresses] = useState<SearchResult[]>([]);
  const [services, setServices] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    setQuery("");
    setSelectedIndex(0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    Promise.all([
      fetch("/api/addresses").then((r) => r.json()).catch(() => ({ addresses: [] })),
      fetch("/api/services").then((r) => r.json()).catch(() => ({ services: [] })),
    ]).then(([addrData, svcData]) => {
      setAddresses((addrData.addresses || []).map((a: any) => ({
        id: `a-${a.id}`,
        type: "address" as const,
        title: a.nickname || a.street,
        subtitle: `${a.city}, ${a.state} ${a.zip}`,
        href: `/addresses/${a.id}`,
        icon: typeIcons[a.type] || MapPin,
      })));
      setServices((svcData.services || []).map((s: any) => ({
        id: `s-${s.id}`,
        type: "service" as const,
        title: s.providerName,
        subtitle: `${(s.category || "").replace(/_/g, " ")}${s.address ? ` - ${s.address.city || ""}` : ""}`,
        href: `/services/${s.id}`,
        icon: Zap,
      })));
    });
  }, [open]);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults(pages.slice(0, 8));
      setSelectedIndex(0);
      return;
    }

    const matched: SearchResult[] = [];
    pages.forEach((p) => {
      if (p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)) matched.push(p);
    });
    addresses.forEach((a) => {
      if (a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) matched.push(a);
    });
    services.forEach((s) => {
      if (s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q)) matched.push(s);
    });
    setResults(matched.slice(0, 12));
    setSelectedIndex(0);
  }, [query, addresses, services]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].href);
    }
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/45"
        onClick={() => setOpen(false)}
      />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border shadow-2xl"
        style={{ background: "color-mix(in srgb, var(--surface-secondary) 97%, transparent)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search addresses, services, pages..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="rounded-lg p-1 text-foreground/35 transition hover:bg-foreground/5 hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-foreground/40">No results for &quot;{query}&quot;</p>
            </div>
          ) : (
            results.map((result, i) => {
              const Icon = result.icon;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={result.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                    isSelected ? "bg-tone-orange-bg" : "hover:bg-foreground/[0.03]"
                  }`}
                  onClick={() => navigate(result.href)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    result.type === "address" ? "bg-tone-orange-bg" :
                    result.type === "service" ? "bg-tone-cyan-bg" : "bg-foreground/5"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${
                      result.type === "address" ? "text-tone-orange-fg" :
                      result.type === "service" ? "text-tone-cyan-fg" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{result.title}</p>
                    <p className="text-[10px] text-foreground/35 truncate">{result.subtitle}</p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${
                    result.type === "address" ? "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br" :
                    result.type === "service" ? "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" :
                    "bg-foreground/5 text-foreground/40 border-border"
                  }`}>
                    {result.type === "address" ? "Address" : result.type === "service" ? "Service" : "Page"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-foreground/30">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-foreground/5">Up/Down</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-foreground/5">Enter</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-foreground/5">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        className="hidden sm:flex items-center gap-2 w-full max-w-sm rounded-xl border border-border bg-foreground/[0.02] px-3 py-2 text-sm text-foreground/40 hover:bg-foreground/5 transition"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto inline-flex h-5 items-center gap-1 rounded-md border border-border bg-foreground/5 px-1.5 font-mono text-[10px] text-foreground/30">
          Ctrl K
        </kbd>
      </button>
      <button
        className="sm:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5 transition"
        onClick={() => setOpen(true)}
        aria-label="Open search"
      >
        <Search className="h-5 w-5" />
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
