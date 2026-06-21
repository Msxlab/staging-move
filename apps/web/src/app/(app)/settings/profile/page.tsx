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
import { useLocale } from "next-intl";

const inputCls =
  "w-full rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition";
const selectCls =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition";

const PROFILE_COPY = {
  en: {
    back: "Back",
    title: "Profile",
    subtitle: "Manage your personal info and household details",
    unavailable: "Profile unavailable",
    retry: "Retry",
    personalInfo: "Personal Info",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    authManaged: "Managed by authentication provider",
    household: "Household",
    ageRange: "Age Range",
    select: "Select",
    familyStatus: "Family Status",
    statuses: { SINGLE: "Single", COUPLE: "Couple", FAMILY: "Family", OTHER: "Other" },
    options: {
      hasChildren: "Children",
      hasPets: "Pets",
      hasSenior: "Senior",
      hasDisability: "Disability",
      hasMotorcycle: "Motorcycle",
      hasBoatRV: "Boat / RV",
      needsStorage: "Storage",
    },
    childrenCount: "Number of Children",
    petTypes: "Pet Types",
    petPlaceholder: "Dog, cat, bird",
    carCount: "Number of Cars",
    saving: "Saving...",
    save: "Save Profile",
    required: "First and last name are required.",
    consentRequired: "Sensitive profile consent is required.",
    loadFailed: "Failed to load profile",
    saveFailed: "Failed to save profile",
    saved: "Profile saved!",
  },
  es: {
    back: "Volver",
    title: "Perfil",
    subtitle: "Administra tu informacion personal y los detalles de tu hogar",
    unavailable: "Perfil no disponible",
    retry: "Reintentar",
    personalInfo: "Informacion personal",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Email",
    authManaged: "Administrado por el proveedor de autenticacion",
    household: "Hogar",
    ageRange: "Rango de edad",
    select: "Seleccionar",
    familyStatus: "Situacion familiar",
    statuses: { SINGLE: "Soltero/a", COUPLE: "Pareja", FAMILY: "Familia", OTHER: "Otro" },
    options: {
      hasChildren: "Hijos",
      hasPets: "Mascotas",
      hasSenior: "Adulto mayor",
      hasDisability: "Discapacidad",
      hasMotorcycle: "Motocicleta",
      hasBoatRV: "Bote / RV",
      needsStorage: "Almacenamiento",
    },
    childrenCount: "Numero de hijos",
    petTypes: "Tipos de mascotas",
    petPlaceholder: "Perro, gato, ave",
    carCount: "Numero de autos",
    saving: "Guardando...",
    save: "Guardar perfil",
    required: "Nombre y apellido son obligatorios.",
    consentRequired: "Se requiere consentimiento para datos sensibles del perfil.",
    loadFailed: "No se pudo cargar el perfil",
    saveFailed: "No se pudo guardar el perfil",
    saved: "Perfil guardado",
  },
} as const;

const householdOptionKeys = [
  { key: "hasChildren", icon: Baby },
  { key: "hasPets", icon: Dog },
  { key: "hasSenior", icon: User },
  { key: "hasDisability", icon: Accessibility },
  { key: "hasMotorcycle", icon: Bike },
  { key: "hasBoatRV", icon: ShipWheel },
  { key: "needsStorage", icon: Archive },
] as const;

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? PROFILE_COPY.es : PROFILE_COPY.en;
}

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
  const locale = useLocale();
  const copy = copyForLocale(locale);
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
        throw new Error(data.error || copy.loadFailed);
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
      setLoadError(error?.message || copy.loadFailed);
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
      toast.error(copy.required);
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
          throw new Error(data.error || copy.consentRequired);
        }
      }

      const { email: _email, ...profilePayload } = form;
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || copy.saveFailed);
      }
      toast.success(copy.saved);
    } catch (err: any) {
      toast.error(err.message || copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-tone-orange-fg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
        >
          <ArrowLeft className="h-4 w-4" />{copy.back}
        </Link>
        <div className="rounded-2xl border border-destructive bg-destructive/5 p-6">
          <h1 className="text-xl font-semibold text-foreground">{copy.unavailable}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button
            onClick={() => void loadProfile()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-foreground/5"
          >
            {copy.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
        >
          <ArrowLeft className="h-4 w-4" />{copy.back}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-tone-orange-fg" />
          <h2 className="text-sm font-semibold text-foreground">{copy.personalInfo}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.firstName}</label>
            <input className={inputCls} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.lastName}</label>
            <input className={inputCls} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.email}</label>
          <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={form.email} disabled />
          <p className="text-[10px] text-foreground/30 mt-1">{copy.authManaged}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-info" />
          <h2 className="text-sm font-semibold text-foreground">{copy.household}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.ageRange}</label>
            <select className={selectCls} value={form.ageRange} onChange={(e) => update("ageRange", e.target.value)}>
              <option value="">{copy.select}</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55+">55+</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.familyStatus}</label>
            <select className={selectCls} value={form.familyStatus} onChange={(e) => update("familyStatus", e.target.value)}>
              <option value="SINGLE">{copy.statuses.SINGLE}</option>
              <option value="COUPLE">{copy.statuses.COUPLE}</option>
              <option value="FAMILY">{copy.statuses.FAMILY}</option>
              <option value="OTHER">{copy.statuses.OTHER}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {householdOptionKeys.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => update(item.key, !(form as any)[item.key])}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm transition ${
                (form as any)[item.key]
                  ? "border-tone-orange-br bg-tone-orange-bg text-foreground"
                  : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">{copy.options[item.key]}</span>
            </button>
          ))}
        </div>

        {form.hasChildren ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.childrenCount}</label>
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
            <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.petTypes}</label>
            <input
              className={inputCls}
              placeholder={copy.petPlaceholder}
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
          <label className="text-xs font-medium text-muted-foreground block mb-1">{copy.carCount}</label>
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
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.saving}
            </>
          ) : (
            copy.save
          )}
        </button>
      </div>
    </div>
  );
}
