"use client";

import { User, Menu, Settings, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NotificationCenter } from "@/components/layout/notification-center";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslations } from "next-intl";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useCurrentUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
  const userEmail = user?.email ?? "";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{ borderColor: "var(--glass-border)", background: "color-mix(in srgb, var(--surface) 70%, transparent)" }}
    >
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5 transition"
          onClick={onMenuClick}
          aria-label={tNav("menu")}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <NotificationCenter />

          {/* Three-state theme toggle: system → light → dark → system.
              Default `preference="system"` means a new visitor inherits
              their OS setting without interaction. */}
          <ThemeToggle variant="icon" />

          {/* Language selector — mirrors choice into NEXT_LOCALE cookie +
              User.preferredLocale (via /api/user/locale). Page reloads
              after change so server components re-render in new locale. */}
          <LanguageSelector variant="icon" />

          <div className="relative" ref={menuRef}>
            <button
              className="p-1 rounded-full hover:bg-foreground/5 transition"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label={tNav("userMenu")}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500/30 to-cyan-500/30 border border-border flex items-center justify-center">
                {userName ? (
                  <span className="text-xs font-bold text-foreground/80">
                    {userName.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-border backdrop-blur-xl shadow-2xl py-1 z-50"
                style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}
                role="menu"
                aria-label={tNav("userMenu")}
              >
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{userName || tCommon("unknown")}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  {tNav("settings")}
                </Link>
                <Link
                  href="/settings/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  {tNav("editProfile")}
                </Link>
                <div className="border-t border-border my-1" />
                <button
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-foreground/5 transition-colors w-full text-left"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void signOut();
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {tCommon("signOut")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
