"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Calendar, MapPin, Truck } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";
import { getAddressAutocompleteSelectionError } from "@/lib/address-autocomplete-selection";
import Link from "next/link";

interface AddressOption {
  id: string;
  isPrimary?: boolean;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

type DestinationMode = "existing" | "new";

export default function NewMovingPlanPage() {
  const router = useRouter();
  const t = useTranslations("moving");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [form, setForm] = useState({
    fromAddressId: "",
    destinationMode: "new" as DestinationMode,
    toAddressId: "",
    destinationNickname: "",
    destinationStreet: "",
    destinationCity: "",
    destinationState: "",
    destinationZip: "",
    destinationCountry: "USA",
    destinationFormattedAddress: null as string | null,
    destinationPlaceId: null as string | null,
    destinationLatitude: null as number | null,
    destinationLongitude: null as number | null,
    moveDate: "",
    isTemporary: false,
    estimatedDuration: "",
  });

  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => res.json())
      .then((data) => {
        const nextAddresses = data.addresses || [];
        setAddresses(nextAddresses);
        setForm((prev) => {
          const defaultFromAddress = nextAddresses.find((addr: AddressOption) => addr.isPrimary) || nextAddresses[0];
          const fromAddressId = prev.fromAddressId || defaultFromAddress?.id || "";
          const availableDestinations = nextAddresses.filter((addr: AddressOption) => addr.id !== fromAddressId);
          const destinationMode = availableDestinations.length > 0 ? "existing" : "new";
          return {
            ...prev,
            fromAddressId,
            destinationMode,
            toAddressId: destinationMode === "existing" ? availableDestinations[0]?.id || "" : "",
          };
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const availableDestinations = addresses.filter((addr) => addr.id !== form.fromAddressId);
    if (form.destinationMode === "existing" && availableDestinations.length === 0) {
      setForm((prev) => ({ ...prev, destinationMode: "new", toAddressId: "" }));
      return;
    }

    if (
      form.destinationMode === "existing"
      && (!form.toAddressId || form.toAddressId === form.fromAddressId || !availableDestinations.some((addr) => addr.id === form.toAddressId))
    ) {
      setForm((prev) => ({ ...prev, toAddressId: availableDestinations[0]?.id || "" }));
    }
  }, [addresses, form.destinationMode, form.fromAddressId, form.toAddressId]);

  const getAddressLabel = (addr: AddressOption) =>
    `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}${addr.nickname ? ` (${addr.nickname})` : ""}`;

  const availableDestinationAddresses = addresses.filter((addr) => addr.id !== form.fromAddressId);

  const clearDestinationAutocompleteState = (value: typeof form) => {
    const normalized = clearAddressAutocompleteMetadata({
      street: value.destinationStreet,
      city: value.destinationCity,
      state: value.destinationState,
      zip: value.destinationZip,
      country: value.destinationCountry,
      formattedAddress: value.destinationFormattedAddress,
      placeId: value.destinationPlaceId,
      latitude: value.destinationLatitude,
      longitude: value.destinationLongitude,
    });

    return {
      ...value,
      destinationStreet: normalized.street,
      destinationCity: normalized.city,
      destinationState: normalized.state,
      destinationZip: normalized.zip,
      destinationCountry: normalized.country || "USA",
      destinationFormattedAddress: normalized.formattedAddress,
      destinationPlaceId: normalized.placeId,
      destinationLatitude: normalized.latitude,
      destinationLongitude: normalized.longitude,
    };
  };

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => {
      if (field === "fromAddressId") {
        const nextFromAddressId = value as string;
        const nextDestinations = addresses.filter((addr) => addr.id !== nextFromAddressId);
        return {
          ...prev,
          fromAddressId: nextFromAddressId,
          toAddressId: prev.destinationMode === "existing"
            ? nextDestinations.find((addr) => addr.id === prev.toAddressId)?.id || nextDestinations[0]?.id || ""
            : "",
          destinationMode: nextDestinations.length === 0 ? "new" : prev.destinationMode,
        };
      }

      if (field === "destinationStreet" || field === "destinationCity" || field === "destinationState" || field === "destinationZip") {
        return clearDestinationAutocompleteState({ ...prev, [field]: value });
      }

      return { ...prev, [field]: value };
    });

  const handleDestinationAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setForm((prev) => {
      const next = applyAddressAutocompleteResult({
        street: prev.destinationStreet,
        city: prev.destinationCity,
        state: prev.destinationState,
        zip: prev.destinationZip,
        country: prev.destinationCountry,
        formattedAddress: prev.destinationFormattedAddress,
        placeId: prev.destinationPlaceId,
        latitude: prev.destinationLatitude,
        longitude: prev.destinationLongitude,
      }, result);

      return {
        ...prev,
        destinationStreet: next.street,
        destinationCity: next.city,
        destinationState: next.state,
        destinationZip: next.zip,
        destinationCountry: next.country || "USA",
        destinationFormattedAddress: next.formattedAddress,
        destinationPlaceId: next.placeId,
        destinationLatitude: next.latitude,
        destinationLongitude: next.longitude,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fromAddressId) {
      setError(t("errorSelectOrigin"));
      return;
    }
    if (!form.moveDate) {
      setError(t("errorSelectDate"));
      return;
    }
    if (form.destinationMode === "existing" && !form.toAddressId) {
      setError(t("errorSelectDestination"));
      return;
    }
    if (form.destinationMode === "new") {
      if (!form.destinationCity.trim() || !form.destinationState.trim() || !form.destinationZip.trim()) {
        setError(t("errorDestinationFields"));
        return;
      }
      if (form.destinationState.trim().length !== 2) {
        setError(t("errorStateLength"));
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        fromAddressId: form.fromAddressId,
        moveDate: form.moveDate,
        isTemporary: form.isTemporary,
        estimatedDuration: form.estimatedDuration ? parseInt(form.estimatedDuration) : undefined,
      };

      if (form.destinationMode === "existing") {
        payload.toAddressId = form.toAddressId;
      } else {
        const destinationCity = form.destinationCity.trim();
        const destinationState = form.destinationState.trim().toUpperCase();
        payload.destinationAddress = {
          nickname: form.destinationNickname.trim() || `${destinationCity}, ${destinationState}`,
          street: form.destinationStreet.trim() || `${destinationCity}, ${destinationState}`,
          city: destinationCity,
          state: destinationState,
          zip: form.destinationZip.trim(),
          country: form.destinationCountry || "USA",
          type: "HOME",
          ownership: "RENTER",
          isPrimary: false,
          startDate: form.moveDate,
          formattedAddress: form.destinationFormattedAddress,
          placeId: form.destinationPlaceId,
          latitude: form.destinationLatitude,
          longitude: form.destinationLongitude,
        };
      }

      const res = await fetch("/api/moving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("errorCreateFailed"));
      }

      const planId = data?.plan?.id;
      if (!planId) {
        throw new Error(t("errorPlanNotCreated"));
      }

      router.push(`/moving/plan/${planId}`);
    } catch (err: any) {
      setError(err.message || t("errorCreateFailed"));
    } finally {
      setLoading(false);
    }
  };
  const originAddress = addresses.find((address) => address.id === form.fromAddressId);
  const destinationAddress = addresses.find((address) => address.id === form.toAddressId);
  const originPreview = originAddress ? `${originAddress.city}, ${originAddress.state}` : t("originRequired");
  const destinationPreview =
    form.destinationMode === "existing"
      ? destinationAddress ? `${destinationAddress.city}, ${destinationAddress.state}` : t("destinationRequired")
      : form.destinationCity || form.destinationState
        ? `${form.destinationCity || t("destinationRequired")}${form.destinationState ? `, ${form.destinationState}` : ""}`
        : t("enterNewDestination");
  const routeReady =
    Boolean(form.fromAddressId) &&
    Boolean(form.moveDate) &&
    (form.destinationMode === "existing" ? Boolean(form.toAddressId) : Boolean(form.destinationCity && form.destinationState && form.destinationZip));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-2xl">
            <Link href="/moving">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Truck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-primary">Move command</p>
            <h1 className="text-2xl font-bold text-foreground">{t("newPlanTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{originPreview} to {destinationPreview}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/55 p-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{originPreview}</p>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ArrowRight className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-foreground">{destinationPreview}</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{addresses.length}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">addresses</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{form.moveDate || "--"}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">date</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{routeReady ? "Ready" : "Draft"}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">status</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {addresses.length === 0 ? (
        <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" /> {t("addCurrentAddressFirst")}
            </CardTitle>
            <CardDescription>{t("addCurrentAddressFirstDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t("addCurrentAddressFirstHelp")}</p>
            <Button asChild>
              <Link href="/addresses/new">{t("addCurrentAddressButton")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" /> {t("addressesSection")}
              </CardTitle>
              <CardDescription>{t("addressesSectionDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromAddress">{t("originRequired")}</Label>
                <Select id="fromAddress" value={form.fromAddressId} onChange={(e) => update("fromAddressId", e.target.value)} required>
                  <option value="">{t("selectOrigin")}</option>
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>{getAddressLabel(addr)}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("originHint")}
                </p>
              </div>

              <div className="space-y-3">
                <Label>{t("destinationRequired")}</Label>

                {availableDestinationAddresses.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => update("destinationMode", "existing")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        form.destinationMode === "existing"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {t("useSavedAddress")}
                    </button>
                    <button
                      type="button"
                      onClick={() => update("destinationMode", "new")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        form.destinationMode === "new"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {t("enterNewDestination")}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("noSecondAddress")}</p>
                )}

                {form.destinationMode === "existing" && availableDestinationAddresses.length > 0 ? (
                  <Select id="toAddress" value={form.toAddressId} onChange={(e) => update("toAddressId", e.target.value)} required>
                    <option value="">{t("selectDestination")}</option>
                    {availableDestinationAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>{getAddressLabel(addr)}</option>
                    ))}
                  </Select>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="destinationNickname">{t("destinationNickname")}</Label>
                      <Input id="destinationNickname" value={form.destinationNickname} onChange={(e) => update("destinationNickname", e.target.value)} placeholder={t("destinationNicknamePlaceholder")} />
                    </div>
                    <AddressAutocompleteInput
                      id="destinationStreet"
                      label={t("streetAddress")}
                      value={form.destinationStreet}
                      placeholder={t("streetPlaceholder")}
                      onValueChange={(value) => update("destinationStreet", value)}
                      onSelect={handleDestinationAutocompleteSelect}
                      validateSelection={(result) => getAddressAutocompleteSelectionError(
                        { state: form.destinationState, zip: form.destinationZip },
                        result,
                      )}
                      onSelectionRejected={(message) => setError(message)}
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2 sm:col-span-1">
                        <Label htmlFor="destinationCity">{t("cityRequired")}</Label>
                        <Input id="destinationCity" value={form.destinationCity} onChange={(e) => update("destinationCity", e.target.value)} placeholder={t("cityPlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destinationState">{t("stateRequired")}</Label>
                        <Input id="destinationState" value={form.destinationState} maxLength={2} onChange={(e) => update("destinationState", e.target.value.toUpperCase().slice(0, 2))} placeholder={t("statePlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destinationZip">{t("zipRequired")}</Label>
                        <Input id="destinationZip" value={form.destinationZip} onChange={(e) => update("destinationZip", e.target.value)} placeholder={t("zipPlaceholder")} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.35rem] border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" /> {t("scheduleSection")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="moveDate">{t("moveDateRequired")}</Label>
                <Input id="moveDate" type="date" value={form.moveDate} onChange={(e) => update("moveDate", e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isTemporary" checked={form.isTemporary} onChange={(e) => update("isTemporary", e.target.checked)} className="rounded" />
                <Label htmlFor="isTemporary">{t("isTemporaryMove")}</Label>
              </div>
              {form.isTemporary && (
                <div className="space-y-2">
                  <Label htmlFor="estimatedDuration">{t("estimatedDuration")}</Label>
                  <Input id="estimatedDuration" type="number" min="1" placeholder={t("estimatedDurationPlaceholder")} value={form.estimatedDuration} onChange={(e) => update("estimatedDuration", e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.35rem] border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t("afterCreate")}</p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link href="/moving">{tCommon("cancel")}</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("creating") : t("createPlan")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
