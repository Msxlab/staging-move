"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata } from "@/lib/shared-address-autocomplete";
import { getAddressAutocompleteSelectionError } from "@/lib/address-autocomplete-selection";
import {
  ServiceLimitUpsell,
  type ServiceLimitDetails,
} from "@/components/shared/service-limit-upsell";
import { resolveAddressCreateError } from "./address-create-error";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

// Address types and ownership options
const ADDRESS_TYPES = ["HOME", "WORK", "VACATION"];
const OWNERSHIP_OPTIONS = ["OWNER", "RENTER", "FAMILY"];

export default function NewAddressPage() {
  const router = useRouter();
  const t = useTranslations("addresses");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);

  // Build address types with translated labels
  const addressTypes = ADDRESS_TYPES.map((type) => {
    const typeKey = `type_${type.toLowerCase()}`;
    return {
      value: type,
      label: t(typeKey as any),
    };
  });

  // Build ownership options with translated labels
  const ownershipTypes = OWNERSHIP_OPTIONS.map((own) => {
    const ownershipKey = `ownership_${own.toLowerCase()}`;
    return {
      value: own,
      label: t(ownershipKey as any),
    };
  });
  const [form, setForm] = useState({
    type: "HOME",
    nickname: "",
    street: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
    ownership: "RENTER",
    isPrimary: false,
    startDate: new Date().toISOString().split("T")[0],
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [error, setError] = useState<string | null>(null);
  // Plan-gate failures render the same polished upsell modal the services
    // flow uses friendly access-review copy instead of a raw red error box.
  const [addressLimit, setAddressLimit] = useState<ServiceLimitDetails | null>(null);
  const [uspsSuggestion, setUspsSuggestion] = useState<{
    street1: string; street2: string | null; city: string; state: string; zip: string; zipPlus4: string | null;
  } | null>(null);

  const doSave = async (payload: typeof form) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Body parsing is defensive — a non-JSON error response still
        // degrades to the friendly fallback message, never a crash.
        const data = await res.json().catch(() => null);
        const resolution = resolveAddressCreateError(res.status, data, "Failed to create address");
        if (resolution.kind === "limit") {
          setAddressLimit(resolution.details);
          setLoading(false);
          return;
        }
        throw new Error(resolution.message);
      }
      router.push("/addresses");
    } catch (err: any) {
      setError(err?.message || "Failed to create address");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // USPS address validation (Tier 2): offer a standardized correction when
    // available. Fail-open + inert unless the plan is entitled AND USPS is
    // configured — it never blocks saving.
    try {
      const v = await fetch("/api/addresses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ street1: form.street, street2: form.street2 || null, city: form.city, state: form.state, zip: form.zip }),
      });
      if (v.ok) {
        const data = await v.json();
        if (data?.enabled && data.status === "CORRECTED" && data.suggestion) {
          setUspsSuggestion(data.suggestion);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fail open — validation outage must never block address entry
    }
    await doSave(form);
  };

  const updateField = (field: string, value: string | boolean | number | null) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "street" || field === "city" || field === "state" || field === "zip") {
        return clearAddressAutocompleteMetadata(next);
      }
      return next;
    });
  };

  const handleAutocompleteSelect = (result: Parameters<typeof applyAddressAutocompleteResult<typeof form>>[1]) => {
    setForm((prev) => applyAddressAutocompleteResult(prev, result));
  };
  const selectedTypeLabel = addressTypes.find((type) => type.value === form.type)?.label || t("type_home" as any);
  const requiredComplete = [form.street, form.city, form.state, form.zip].filter(Boolean).length;
  const placeLine = [form.city, form.state, form.zip].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ServiceLimitUpsell
        open={Boolean(addressLimit)}
        details={addressLimit}
        onClose={() => setAddressLimit(null)}
      />

      <section className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-2xl">
            <Link href="/addresses">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-primary">Address command</p>
            <h1 className="text-2xl font-bold text-foreground">{form.nickname || selectedTypeLabel || t("newTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{placeLine || t("formSubtitle")}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{requiredComplete}/4</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">required</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{form.ownership}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">ownership</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{form.isPrimary ? "Yes" : "No"}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">primary</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {uspsSuggestion && (
        <div className="p-4 rounded-xl border border-tone-sky-br bg-tone-sky-bg space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("uspsSuggestTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {uspsSuggestion.street1}
            {uspsSuggestion.street2 ? `, ${uspsSuggestion.street2}` : ""}, {uspsSuggestion.city}, {uspsSuggestion.state}{" "}
            {uspsSuggestion.zipPlus4 ? `${uspsSuggestion.zip}-${uspsSuggestion.zipPlus4}` : uspsSuggestion.zip}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const s = uspsSuggestion;
                const next = {
                  ...form,
                  street: s.street1,
                  street2: s.street2 || form.street2,
                  city: s.city,
                  state: s.state,
                  zip: s.zipPlus4 ? `${s.zip}-${s.zipPlus4}` : s.zip,
                };
                setForm(next);
                setUspsSuggestion(null);
                void doSave(next);
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              {t("uspsUseIt")}
            </button>
            <button
              type="button"
              onClick={() => {
                setUspsSuggestion(null);
                void doSave(form);
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground"
            >
              {t("uspsKeepMine")}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type & Nickname */}
        <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">{t("basicInfoTitle")}</CardTitle>
            <CardDescription>{t("basicInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {addressTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateField("type", type.value)}
                  className={`p-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                    form.type === type.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">{t("nickname")}</Label>
              <Input
                id="nickname"
                placeholder={t("nicknamePlaceholder")}
                value={form.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">{t("detailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressAutocompleteInput
              id="street"
              label={t("streetRequired")}
              value={form.street}
              placeholder={t("streetPlaceholder")}
              required
              onValueChange={(value) => updateField("street", value)}
              onSelect={handleAutocompleteSelect}
              validateSelection={(result) => getAddressAutocompleteSelectionError(form, result)}
              onSelectionRejected={(message) => setError(message)}
            />
            <div className="space-y-2">
              <Label htmlFor="street2">{t("apt")}</Label>
              <Input
                id="street2"
                placeholder="Apt 4B"
                value={form.street2}
                onChange={(e) => updateField("street2", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="city">{t("cityRequired")}</Label>
                <Input
                  id="city"
                  placeholder={t("cityPlaceholder")}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">{t("stateRequired")}</Label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("select")}</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">{t("zipRequired")}</Label>
                <Input
                  id="zip"
                  placeholder="78701"
                  maxLength={10}
                  value={form.zip}
                  onChange={(e) => updateField("zip", e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ownership & Dates */}
        <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">{t("ownershipTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ownershipTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateField("ownership", type.value)}
                  className={`p-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                    form.ownership === type.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t("moveInDateRequired")}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => updateField("isPrimary", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">{t("setPrimaryAddress")}</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button asChild variant="outline">
            <Link href="/addresses">{tCommon("cancel")}</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? tCommon("saving") : t("saveAddress")}
          </Button>
        </div>
      </form>
    </div>
  );
}
