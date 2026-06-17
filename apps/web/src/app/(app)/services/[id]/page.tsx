"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Globe, Phone, Mail, Calendar, DollarSign, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";

interface ServiceDetail {
  id: string;
  category: string;
  providerName: string;
  accountNumber?: string;
  website?: string;
  phone?: string;
  email?: string;
  monthlyCost?: number;
  billingDay?: number;
  billingCycle?: string;
  autoRenewal: boolean;
  contractEndDate?: string;
  isActive: boolean;
  activatedAt?: string;
  notes?: string;
  address?: { nickname?: string; city?: string; state?: string };
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/services/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setService(data.service))
      .catch(() => router.push("/services"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    const res = await fetch(`/api/services/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    if (res.ok) {
      router.push("/services");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.code === "UNAUTHORIZED") {
      toast.error(data?.error || "Please sign in again.");
      router.push(`/sign-in?redirect=${encodeURIComponent(`/services/${id}`)}`);
      return;
    }
    if (data?.code === "EMAIL_VERIFICATION_REQUIRED") {
      toast.error(data?.error || "Please verify your email to manage services.");
      router.push(data.redirectTo || `/verify-email?redirect=${encodeURIComponent(`/services/${id}`)}`);
      return;
    }
    if (data?.code === "NOT_FOUND") {
      toast.error(data?.error || "Service not found.");
      router.push("/services");
      return;
    }
    if (data?.code === "FORBIDDEN") {
      toast.error(data?.error || "You don't have permission to remove this service.");
      return;
    }
    if (data?.code === "INVALID_CONTENT_TYPE") {
      toast.error("Could not remove this service. Please refresh and try again.");
      return;
    }
    toast.error(data?.error || "Failed to remove service");
  };

  if (loading || !service) return <LoadingSpinner />;

  const addressLabel = service.address?.nickname || (service.address ? `${service.address.city}, ${service.address.state}` : "");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/services">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{service.providerName}</h1>
            {addressLabel && <p className="text-sm text-muted-foreground">{addressLabel}</p>}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/services/${service.id}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={service.isActive ? "success" : "secondary"}>
          {service.isActive ? "Active" : "Inactive"}
        </Badge>
        <Badge variant="outline">{service.category.replace(/_/g, " ")}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Monthly Cost
            </span>
            <span className="font-semibold">{service.monthlyCost ? formatCurrency(service.monthlyCost) : "—"}</span>
          </div>
          {service.billingDay && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Billing Day
                </span>
                <span>{service.billingDay}th of each month</span>
              </div>
            </>
          )}
          {service.billingCycle && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Billing Cycle</span>
                <span>{service.billingCycle}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auto-Renewal</span>
            <span>{service.autoRenewal ? "Yes" : "No"}</span>
          </div>
          {service.contractEndDate && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contract Ends</span>
                <span>{new Date(service.contractEndDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(service.website || service.phone || service.email || service.accountNumber) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {service.website && (
              <a href={service.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Globe className="h-4 w-4" /> {service.website}
              </a>
            )}
            {service.phone && (
              <a href={`tel:${service.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Phone className="h-4 w-4" /> {service.phone}
              </a>
            )}
            {service.email && (
              <a href={`mailto:${service.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail className="h-4 w-4" /> {service.email}
              </a>
            )}
            {service.accountNumber && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account #</span>
                  <span className="font-mono">{service.accountNumber}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {service.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{service.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <ConfirmDialog
          title="Remove from my services"
          description="This removes the service from your account/address. It does not delete the provider from LocateFlow."
          confirmLabel="Remove from my services"
          loadingLabel="Removing..."
          onConfirm={handleDelete}
          trigger={<Button variant="destructive" size="sm">Remove from my services</Button>}
        />
      </div>
    </div>
  );
}
