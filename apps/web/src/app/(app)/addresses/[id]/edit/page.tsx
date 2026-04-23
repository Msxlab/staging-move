"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";
import { toast } from "sonner";

export default function EditAddressPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    startDate: "",
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    fetch(`/api/addresses/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        const a = data.address;
        setForm({
          type: a.type || "HOME",
          nickname: a.nickname || "",
          street: a.street || "",
          street2: a.street2 || "",
          city: a.city || "",
          state: a.state || "",
          zip: a.zip || "",
          country: a.country || "USA",
          ownership: a.ownership || "RENTER",
          isPrimary: a.isPrimary || false,
          startDate: a.startDate ? a.startDate.slice(0, 10) : "",
          formattedAddress: a.formattedAddress || null,
          placeId: a.placeId || null,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
        });
      })
      .catch(() => router.push("/addresses"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const update = (field: string, value: string | boolean | number | null) => setForm((prev) => {
    const next = { ...prev, [field]: value };
    if (field === "street" || field === "city" || field === "state" || field === "zip") {
      return clearAddressAutocompleteMetadata(next);
    }
    return next;
  });

  const handleAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setForm((prev) => applyAddressAutocompleteResult(prev, result));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update address");
      }
      toast.success("Address updated!");
      router.push(`/addresses/${id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Address</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Address Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => update("type", e.target.value)}>
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="VACATION">Vacation</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="STORAGE">Storage</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nickname</Label>
                <Input value={form.nickname} onChange={(e) => update("nickname", e.target.value)} />
              </div>
            </div>
            <AddressAutocompleteInput
              label="Street Address *"
              value={form.street}
              placeholder="123 Main Street"
              required
              onValueChange={(value) => update("street", value)}
              onSelect={handleAutocompleteSelect}
            />
            <div className="space-y-2">
              <Label>Street Address 2</Label>
              <Input value={form.street2} onChange={(e) => update("street2", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Input maxLength={2} value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase())} required />
              </div>
              <div className="space-y-2">
                <Label>ZIP *</Label>
                <Input maxLength={10} value={form.zip} onChange={(e) => update("zip", e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ownership</Label>
                <Select value={form.ownership} onChange={(e) => update("ownership", e.target.value)}>
                  <option value="OWNER">Owner</option>
                  <option value="RENTER">Renter</option>
                  <option value="FAMILY">Family</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Move-in Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => update("isPrimary", e.target.checked)} className="rounded" />
              <Label htmlFor="isPrimary">Set as primary address</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
