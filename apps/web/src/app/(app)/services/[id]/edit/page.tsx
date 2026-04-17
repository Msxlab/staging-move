"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { toast } from "sonner";

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerName: "",
    accountNumber: "",
    website: "",
    phone: "",
    email: "",
    monthlyCost: "",
    billingDay: "",
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/services/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        const s = data.service;
        setForm({
          providerName: s.providerName || "",
          accountNumber: s.accountNumber || "",
          website: s.website || "",
          phone: s.phone || "",
          email: s.email || "",
          monthlyCost: s.monthlyCost != null ? String(s.monthlyCost) : "",
          billingDay: s.billingDay != null ? String(s.billingDay) : "",
          notes: s.notes || "",
        });
      })
      .catch(() => router.push("/services"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        providerName: form.providerName,
        accountNumber: form.accountNumber || undefined,
        website: form.website || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        monthlyCost: form.monthlyCost ? parseFloat(form.monthlyCost) : undefined,
        billingDay: form.billingDay ? parseInt(form.billingDay) : undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update service");
      }
      toast.success("Service updated!");
      router.push(`/services/${id}`);
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
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Service</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Service Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="providerName">Provider Name *</Label>
              <Input id="providerName" value={form.providerName} onChange={(e) => update("providerName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input id="accountNumber" value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Contact & Billing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => update("website", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyCost">Monthly Cost ($)</Label>
                <Input id="monthlyCost" type="number" step="0.01" value={form.monthlyCost} onChange={(e) => update("monthlyCost", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingDay">Billing Day</Label>
                <Input id="billingDay" type="number" min="1" max="31" value={form.billingDay} onChange={(e) => update("billingDay", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
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
