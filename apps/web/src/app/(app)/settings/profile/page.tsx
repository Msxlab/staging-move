"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, User, Home, Car, Baby, Dog, Accessibility } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    ageRange: "", familyStatus: "SINGLE",
    hasChildren: false, childrenCount: 0,
    hasPets: false, petTypes: [] as string[],
    carCount: 0, hasSenior: false, hasDisability: false,
    hasMotorcycle: false, hasBoatRV: false, needsStorage: false,
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setForm((prev) => ({ ...prev, firstName: data.user.firstName || "", lastName: data.user.lastName || "", email: data.user.email || "" }));
        }
        if (data.profile) {
          const p = data.profile;
          setForm((prev) => ({
            ...prev, ageRange: p.ageRange || "", familyStatus: p.familyStatus || "SINGLE",
            hasChildren: p.hasChildren || false, childrenCount: p.childrenCount || 0,
            hasPets: p.hasPets || false, carCount: p.carCount || 0,
            hasSenior: p.hasSenior || false, hasDisability: p.hasDisability || false,
            hasMotorcycle: p.hasMotorcycle || false, hasBoatRV: p.hasBoatRV || false, needsStorage: p.needsStorage || false,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (field: string, value: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { email: _email, ...profilePayload } = form;
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save");
      toast.success("Profile saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
    </div>
  );

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";
  const selectCls = "w-full rounded-xl border border-white/10 bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-sm text-white/40">Manage your personal info and household details</p>
        </div>
      </div>

      {/* Personal Info */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Personal Info</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">First Name</label>
            <input className={inputCls} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Last Name</label>
            <input className={inputCls} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1">Email</label>
          <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={form.email} disabled />
          <p className="text-[10px] text-white/20 mt-1">Managed by authentication provider</p>
        </div>
      </div>

      {/* Household */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-info" />
          <h2 className="text-sm font-semibold text-white">Household</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Age Range</label>
            <select className={selectCls} value={form.ageRange} onChange={(e) => update("ageRange", e.target.value)}>
              <option value="">Select</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55+">55+</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Family Status</label>
            <select className={selectCls} value={form.familyStatus} onChange={(e) => update("familyStatus", e.target.value)}>
              <option value="SINGLE">Single</option>
              <option value="COUPLE">Couple</option>
              <option value="FAMILY">Family</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Toggles grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { key: "hasChildren", label: "Children", icon: "👶" },
            { key: "hasPets", label: "Pets", icon: "🐾" },
            { key: "hasSenior", label: "Senior", icon: "👴" },
            { key: "hasDisability", label: "Disability", icon: "♿" },
            { key: "hasMotorcycle", label: "Motorcycle", icon: "🏍️" },
            { key: "hasBoatRV", label: "Boat / RV", icon: "🚤" },
            { key: "needsStorage", label: "Storage", icon: "📦" },
          ].map((item) => (
            <button key={item.key} type="button"
              onClick={() => update(item.key, !(form as any)[item.key])}
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition ${
                (form as any)[item.key]
                  ? "border-orange-500/30 bg-orange-500/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/[0.05]"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {form.hasChildren && (
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Number of Children</label>
            <input type="number" min="0" max="20" className={inputCls}
              value={form.childrenCount} onChange={(e) => update("childrenCount", parseInt(e.target.value) || 0)} />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1">Number of Cars</label>
          <input type="number" min="0" max="10" className={inputCls}
            value={form.carCount} onChange={(e) => update("carCount", parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
