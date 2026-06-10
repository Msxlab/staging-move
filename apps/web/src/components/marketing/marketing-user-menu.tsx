"use client";

import { LayoutDashboard, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/hooks/use-current-user";

export function MarketingUserMenu() {
  const { user, signOut } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
  const userEmail = user?.email ?? "";
  const initials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="p-1 rounded-full hover:bg-foreground/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={tNav("userMenu")}
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-transparent border border-border flex items-center justify-center">
          {initials ? (
            <span className="text-xs font-bold text-foreground/80">{initials}</span>
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl py-1 z-50"
          role="menu"
          aria-label={tNav("userMenu")}
        >
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {userName || tCommon("unknown")}
            </p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            {tNav("dashboard")}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            {tNav("settings")}
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            {tNav("editProfile")}
          </Link>
          <div className="border-t border-border my-1" />
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-sm text-destructive/80 hover:text-destructive hover:bg-foreground/5 transition-colors w-full text-left"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {tCommon("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
