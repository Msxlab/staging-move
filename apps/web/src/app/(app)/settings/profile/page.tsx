"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Accessibility,
  Archive,
  ArrowLeft,
  Baby,
  Bike,
  Dog,
  Home,
  Loader2,
  ShipWheel,
  User,
} from "lucide-react";
import { toast } from "sonner";

const inputCls =
  "w-full rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";
const selectCls =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";

const householdOptions = [
  { key: "hasChildren", label: "Children", icon: Baby },
  { key: "hasPets", label: "Pets", icon: Dog },
  { key: "hasSenior", label: "Senior", icon: User },
  { key: "hasDisability", label: "Disability", icon: Accessibility },
  { key: "hasMotorcycle", label: "Motorcycle", icon: Bike },
  { key: "hasBoatRV", label: "Boat / RV", icon: ShipWheel },
  { key: "needsStorage", label: "Storage", icon: Archive },
] as const;

function parsePetTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    ageRange: "",
    familyStatus: "SINGLE",
    hasChildren: false,
    childrenCount: 0,
    hasPets: false,
    petTypes: [] as string[],
    carCount: 0,
    hasSenior: false,
    hasDisability: false,
    hasMotorcycle: false,
    hasBoatRV: false,
    needsStorage: false,
  });

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      setForm((prev) => ({
        ...prev,
        firstName: data.user?.firstName || "",
        lastName: data.user?.lastName || "",
        email: data.user?.email || "",
        ageRange: data.profile?.ageRange || "",
        familyStatus: data.profile?.familyStatus || "SINGLE",
        hasChildren: data.profile?.hasChildren || false,
        childrenCount: data.profile?.childrenCount || 0,
        hasPets: data.profile?.hasPets || false,
        petTypes: parsePetTypes(data.profile?.petTypes),
        carCount: data.profile?.carCount || 0,
        hasSenior: data.profile?.hasSenior || false,
        hasDisability: data.profile?.hasDisability || false,
        hasMotorcycle: data.profile?.hasMotorcycle || false,
        hasBoatRV: data.profile?.hasBoatRV || false,
        needsStorage: data.profile?.needsStorage || false,
      }));
    } catch (error: any) {
      setLoadError(error?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const update = (field: string, value: string | boolean | number | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }

    setSaving(true);
    try {
      if (form.hasDisability) {
        const consentRes = await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grants: [{ category: "SENSITIVE", granted: true }] }),
        });
        if (!consentRes.ok) {
          const data = await consentRes.json().catch(() => ({}));
          throw new Error(data.error || "Sensitive profile consent is required.");
        }
      }

      const { email: _email, ...profilePayload } = form;
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Failed to save");
      }
      toast.success("Profile saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold text-foreground">Profile unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button
            onClick={() => void loadProfile()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-foreground/5"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your personal info and household details</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-foreground">Personal Info</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">First Name</label>
            <input className={inputCls} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Last Name</label>
            <input className={inputCls} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
          <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={form.email} disabled />
          <p className="text-[10px] text-foreground/30 mt-1">Managed by authentication provider</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-info" />
          <h2 className="text-sm font-semibold text-foreground">Household</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Age Range</label>
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
            <label className="text-xs font-medium text-muted-foreground block mb-1">Family Status</label>
            <select className={selectCls} value={form.familyStatus} onChange={(e) => update("familyStatus", e.target.value)}>
              <option value="SINGLE">Single</option>
              <option value="COUPLE">Couple</option>
              <option value="FAMILY">Family</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {householdOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => update(item.key, !(form as any)[item.key])}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm transition ${
                (form as any)[item.key]
                  ? "border-orange-500/30 bg-orange-500/10 text-foreground"
                  : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {form.hasChildren ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Number of Children</label>
            <input
              type="number"
              min="0"
              max="20"
              className={inputCls}
              value={form.childrenCount}
              onChange={(e) => update("childrenCount", parseInt(e.target.value, 10) || 0)}
            />
          </div>
        ) : null}
        {form.hasPets ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Pet Types</label>
            <input
              className={inputCls}
              placeholder="Dog, cat, bird"
              value={form.petTypes.join(", ")}
              onChange={(e) =>
                update(
                  "petTypes",
                  e.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
                )
              }
            />
          </div>
        ) : null}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Number of Cars</label>
          <input
            type="number"
            min="0"
            max="10"
            className={inputCls}
            value={form.carCount}
            onChange={(e) => update("carCount", parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Profile"
          )}
        </button>
      </div>
    </div>
  );
}
