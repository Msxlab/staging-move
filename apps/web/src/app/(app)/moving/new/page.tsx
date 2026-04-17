"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Truck } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";
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
      setError("Select an origin address to start your moving plan.");
      return;
    }
    if (!form.moveDate) {
      setError("Select your move date.");
      return;
    }
    if (form.destinationMode === "existing" && !form.toAddressId) {
      setError("Select a destination address or switch to entering a new one.");
      return;
    }
    if (form.destinationMode === "new") {
      if (!form.destinationCity.trim() || !form.destinationState.trim() || !form.destinationZip.trim()) {
        setError("Enter destination city, state, and ZIP code.");
        return;
      }
      if (form.destinationState.trim().length !== 2) {
        setError("Destination state must be a 2-letter code.");
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
        throw new Error(data.error || "Failed to create moving plan");
      }

      const planId = data?.plan?.id;
      if (!planId) {
        throw new Error("Moving plan could not be created.");
      }

      router.push(`/moving/${planId}`);
    } catch (err: any) {
      setError(err.message || "Failed to create moving plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/moving">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Moving Plan</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {addresses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Add your current address first
            </CardTitle>
            <CardDescription>Your current address is used as the move origin before we can build a moving plan.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Create your current address once, then you can plan moves to saved or brand-new destinations.</p>
            <Link href="/addresses/new"><Button>Add Current Address</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" /> Addresses
              </CardTitle>
              <CardDescription>We&apos;ll auto-select your current address as the origin and create the destination in the same flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromAddress">Moving From *</Label>
                <Select id="fromAddress" value={form.fromAddressId} onChange={(e) => update("fromAddressId", e.target.value)} required>
                  <option value="">Select origin address</option>
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>{getAddressLabel(addr)}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Your primary or most recent address is selected automatically when available.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Moving To *</Label>

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
                      Use saved address
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
                      Enter new destination
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">You don&apos;t have a second saved address yet, so we&apos;ll create the destination as part of this plan.</p>
                )}

                {form.destinationMode === "existing" && availableDestinationAddresses.length > 0 ? (
                  <Select id="toAddress" value={form.toAddressId} onChange={(e) => update("toAddressId", e.target.value)} required>
                    <option value="">Select destination address</option>
                    {availableDestinationAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>{getAddressLabel(addr)}</option>
                    ))}
                  </Select>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="destinationNickname">Destination Nickname</Label>
                      <Input id="destinationNickname" value={form.destinationNickname} onChange={(e) => update("destinationNickname", e.target.value)} placeholder="New home, Austin apartment, etc." />
                    </div>
                    <AddressAutocompleteInput
                      id="destinationStreet"
                      label="Street Address"
                      value={form.destinationStreet}
                      placeholder="123 New St (optional)"
                      onValueChange={(value) => update("destinationStreet", value)}
                      onSelect={handleDestinationAutocompleteSelect}
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2 sm:col-span-1">
                        <Label htmlFor="destinationCity">City *</Label>
                        <Input id="destinationCity" value={form.destinationCity} onChange={(e) => update("destinationCity", e.target.value)} placeholder="Austin" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destinationState">State *</Label>
                        <Input id="destinationState" value={form.destinationState} maxLength={2} onChange={(e) => update("destinationState", e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destinationZip">ZIP *</Label>
                        <Input id="destinationZip" value={form.destinationZip} onChange={(e) => update("destinationZip", e.target.value)} placeholder="78701" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="moveDate">Move Date *</Label>
                <Input id="moveDate" type="date" value={form.moveDate} onChange={(e) => update("moveDate", e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isTemporary" checked={form.isTemporary} onChange={(e) => update("isTemporary", e.target.checked)} className="rounded" />
                <Label htmlFor="isTemporary">This is a temporary move</Label>
              </div>
              {form.isTemporary && (
                <div className="space-y-2">
                  <Label htmlFor="estimatedDuration">Estimated Duration (days)</Label>
                  <Input id="estimatedDuration" type="number" min="1" placeholder="e.g. 90" value={form.estimatedDuration} onChange={(e) => update("estimatedDuration", e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong>After creating your plan</strong>, we&apos;ll open it immediately with auto-generated checklist tasks, service migration guidance, and state-aware next steps.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/moving"><Button variant="outline">Cancel</Button></Link>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Moving Plan"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
