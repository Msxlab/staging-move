"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Globe, Phone, Mail, Calendar, DollarSign, FileText, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

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
  documents?: { id: string; fileName: string; uploadedAt: string }[];
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
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/services");
  };

  if (loading || !service) return <LoadingSpinner />;

  const addressLabel = service.address?.nickname || (service.address ? `${service.address.city}, ${service.address.state}` : "");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/services">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{service.providerName}</h1>
            {addressLabel && <p className="text-sm text-muted-foreground">{addressLabel}</p>}
          </div>
        </div>
        <Link href={`/services/${service.id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
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

      {service.documents && service.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {service.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{doc.fileName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
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
          title="Delete Service"
          description="Are you sure you want to delete this service? This action cannot be undone."
          confirmLabel="Delete Service"
          onConfirm={handleDelete}
          trigger={<Button variant="destructive" size="sm">Delete Service</Button>}
        />
      </div>
    </div>
  );
}
