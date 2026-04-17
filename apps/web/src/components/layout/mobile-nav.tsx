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

const mobileNavItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Addresses", href: "/addresses", icon: MapPin },
  { name: "Services", href: "/services", icon: Zap },
  { name: "Moving", href: "/moving", icon: Truck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t border-white/5 md:hidden safe-area-inset-bottom" style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
      <div className="flex justify-around items-center h-16">
        {mobileNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors",
                isActive
                  ? "text-orange-400"
                  : "text-white/30"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
