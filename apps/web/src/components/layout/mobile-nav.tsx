"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MapPin,
  Zap,
  Truck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const mobileNavItems = [
    { key: "dashboard", href: "/dashboard", icon: Home },
    { key: "addresses", href: "/addresses", icon: MapPin },
    { key: "moving", href: "/moving", icon: Truck },
    { key: "services", href: "/services", icon: Zap },
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-xl md:hidden safe-area-inset-bottom"
      style={{ background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}
    >
      <div className="flex h-16 items-center justify-around gap-1 px-1.5">
        {mobileNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const label = t(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors",
                isActive
                  ? "bg-tone-orange-bg text-tone-orange-fg"
                  : "text-foreground/40"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 h-1 w-5 rounded-full bg-current"
                />
              )}
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
