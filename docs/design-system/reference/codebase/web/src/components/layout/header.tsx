"use client";

import { User, Menu, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NotificationCenter } from "@/components/layout/notification-center";
import { GlobalSearch } from "@/components/layout/global-search";
import { useTheme } from "@/components/theme-provider";
import { useCurrentUser } from "@/hooks/use-current-user";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useCurrentUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          className="md:hidden p-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition"
          onClick={onMenuClick}
          aria-label="Toggle menu"
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              className="p-1 rounded-full hover:bg-white/5 transition"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center">
                {userName ? (
                  <span className="text-xs font-bold text-white/80">
                    {userName.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <User className="h-4 w-4 text-white/50" />
                )}
              </div>
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl py-1 z-50"
                style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}
                role="menu"
                aria-label="User menu"
              >
                <div className="px-3 py-2.5 border-b border-white/5">
                  <p className="text-sm font-medium text-white">{userName || "User"}</p>
                  <p className="text-xs text-white/40 truncate">{userEmail}</p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                  role="menuitem"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  Edit Profile
                </Link>
                <div className="border-t border-white/5 my-1" />
                <button
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors w-full text-left"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void signOut();
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
