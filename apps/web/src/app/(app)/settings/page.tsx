"use client";

import { useState } from "react";
import { User, Bell, CreditCard, Download, Shield, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { AppearanceCard } from "@/components/settings/appearance-card";

const appSections = [
  { title: "Budget", description: "Track monthly expenses and spending", icon: DollarSign, href: "/budget" },
];

const accountSections = [
  { title: "Profile", description: "Manage your personal info and preferences", icon: User, href: "/settings/profile" },
  { title: "Notifications", description: "Configure email and push notifications", icon: Bell, href: "/settings/notifications" },
  { title: "Subscription", description: "Manage your plan and billing", icon: CreditCard, href: "/settings/subscription" },
  { title: "Data Export", description: "Export your data as PDF or CSV", icon: Download, href: "/settings/export" },
  { title: "Privacy & Security", description: "Password, 2FA, and data privacy", icon: Shield, href: "/settings/privacy" },
];

function SectionList({ items }: { items: typeof appSections }) {
  return (
    <div className="space-y-1.5">
      {items.map((section) => (
        <Link key={section.title} href={section.href}>
          <div className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <section.icon className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <p className="text-xs text-white/40">{section.description}</p>
            </div>
            <svg className="h-4 w-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [confirmText, setConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setDeleteStep("deleting");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Local session cookie is invalidated server-side when the account is
        // fully processed; log out on this device immediately.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        toast.success(data.message || "Account deletion initiated. Redirecting...");
        setTimeout(() => { window.location.href = "/"; }, 1500);
      } else {
        toast.error(data.error || "Failed to delete account");
        setDeleteStep("confirm");
      }
    } catch {
      toast.error("Failed to delete account");
      setDeleteStep("confirm");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Settings</h1>
        <p className="text-white/40 mt-1">Manage your account and preferences</p>
      </div>

      {/* App Features */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Features</h2>
        </div>
        <div className="px-2 pb-3">
          <SectionList items={appSections} />
        </div>
      </div>

      {/* Appearance */}
      <AppearanceCard />

      {/* Account Settings */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Account</h2>
        </div>
        <div className="px-2 pb-3">
          <SectionList items={accountSections} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/20 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Delete Account</p>
              <p className="text-xs text-white/30">Permanently delete your account and all data</p>
            </div>
            {deleteStep === "idle" && (
              <button
                onClick={() => setDeleteStep("confirm")}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition"
              >
                Delete Account
              </button>
            )}
          </div>
          {deleteStep !== "idle" && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
              <p className="text-sm text-white/60">
                This action is <span className="font-semibold text-red-400">irreversible</span>. All your addresses, services, documents, moving plans, and account data will be permanently deleted.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/40">Type DELETE to confirm</label>
                <input
                  className="w-full rounded-xl border border-red-500/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={deleteStep === "deleting"}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleteStep === "deleting"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteStep === "deleting" ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : "Permanently Delete My Account"}
                </button>
                <button
                  onClick={() => { setDeleteStep("idle"); setConfirmText(""); }}
                  disabled={deleteStep === "deleting"}
                  className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
