"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata } from "@/lib/shared-address-autocomplete";

const addressTypes = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "VACATION", label: "Vacation" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "STORAGE", label: "Storage" },
  { value: "OTHER", label: "Other" },
];

const ownershipTypes = [
  { value: "OWNER", label: "Owner" },
  { value: "RENTER", label: "Renter" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function NewAddressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create address");
      }
      router.push("/addresses");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/addresses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add New Address</h1>
          <p className="text-muted-foreground">Enter the details of your address</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type & Nickname */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Info</CardTitle>
            <CardDescription>What kind of address is this?</CardDescription>
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
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder='e.g., "Main Residence", "Beach House"'
                value={form.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Address Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressAutocompleteInput
              id="street"
              label="Street Address *"
              value={form.street}
              placeholder="123 Main Street"
              required
              onValueChange={(value) => updateField("street", value)}
              onSelect={handleAutocompleteSelect}
            />
            <div className="space-y-2">
              <Label htmlFor="street2">Apt / Suite / Unit</Label>
              <Input
                id="street2"
                placeholder="Apt 4B"
                value={form.street2}
                onChange={(e) => updateField("street2", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="Austin"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP *</Label>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ownership & Dates</CardTitle>
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
                <Label htmlFor="startDate">Move-in Date *</Label>
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
                  <span className="text-sm font-medium">Set as primary address</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Link href="/addresses">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Address"}
          </Button>
        </div>
      </form>
    </div>
  );
}
