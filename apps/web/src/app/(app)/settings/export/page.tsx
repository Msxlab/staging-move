"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
  Home,
  Briefcase,
  Palmtree,
  MapPin,
  Star,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface AddressInfo {
  id: string;
  type: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  ownership: string;
  startDate: string;
  services?: {
    id: string;
    providerName: string;
    category: string;
    monthlyCost: number;
    billingDay?: number;
  }[];
}

const typeIcons: Record<string, React.ElementType> = {
  HOME: Home,
  WORK: Briefcase,
  VACATION: Palmtree,
};

const exportOptions = [
  { title: "Addresses", description: "Export all addresses with details", icon: FileText, type: "addresses", formats: ["CSV", "JSON"] },
  { title: "Services", description: "Export all services and billing info", icon: FileSpreadsheet, type: "services", formats: ["CSV", "JSON"] },
  { title: "Budget History", description: "Export monthly budget data", icon: FileSpreadsheet, type: "budget", formats: ["CSV", "JSON"] },
  { title: "Moving Plans", description: "Export plans with tasks and boxes", icon: FileText, type: "moving", formats: ["JSON"] },
  { title: "Full Data Export", description: "Export supported account data", icon: Download, type: "full", formats: ["JSON"] },
];

/**
 * Hit `url`, save the response as a download. Reads the filename from
 * `Content-Disposition` so the server controls naming, and surfaces a
 * JSON `error` message when the API rejects the request.
 */
async function downloadFromUrl(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = "Download failed";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const dispo = res.headers.get("content-disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(dispo);
  const filename = match?.[1] || fallbackFilename;
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingFullPdf, setGeneratingFullPdf] = useState(false);

  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((data) => setAddresses(data.addresses || []))
      .catch(() => {})
      .finally(() => setLoadingAddresses(false));
  }, []);

  const handleExport = async (type: string, format: string) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    try {
      await downloadFromUrl(
        `/api/export?type=${type}&format=${format.toLowerCase()}`,
        `locateflow-${type}-export.${format.toLowerCase()}`,
      );
      toast.success(`${type} exported as ${format}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
    setDownloading(null);
  };

  // Per-address monthly expense PDF — produced server-side by pdfkit.
  // No more pop-up window or print dialog dependency.
  const handlePdfReport = async (address: AddressInfo) => {
    setGeneratingPdf(address.id);
    try {
      await downloadFromUrl(
        `/api/export/pdf?type=address&addressId=${encodeURIComponent(address.id)}`,
        `locateflow-${address.nickname || address.street}-report.pdf`,
      );
      toast.success("PDF report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    }
    setGeneratingPdf(null);
  };

  // Full-account snapshot PDF — profile, subscription, addresses,
  // services, moving plans, task summary in a single document.
  const handleFullAccountPdf = async () => {
    setGeneratingFullPdf(true);
    try {
      await downloadFromUrl(
        "/api/export/pdf?type=full",
        "locateflow-account-snapshot.pdf",
      );
      toast.success("Full account PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    }
    setGeneratingFullPdf(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export & Reports</h1>
          <p className="text-sm text-muted-foreground">Download reports and export your data</p>
        </div>
      </div>

      {/* Per-address PDF reports */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileText className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-foreground">Monthly Expense Reports (PDF)</h3>
        </div>
        <p className="text-xs text-foreground/40 px-5 pb-3">
          Pick the address you want a monthly report for. Each PDF is generated on the server with branding,
          category breakdown, and full service details — no print dialog needed.
        </p>
        <div className="px-5 pb-5 space-y-2">
          {loadingAddresses ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-4">No addresses to generate reports for</p>
          ) : (
            addresses.map((addr) => {
              const TypeIcon = typeIcons[addr.type] || MapPin;
              const svcCount = addr.services?.length || 0;
              const monthlyCost = addr.services?.reduce((sum, s) => sum + (s.monthlyCost || 0), 0) || 0;
              const isGenerating = generatingPdf === addr.id;
              return (
                <div key={addr.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition">
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
                    <TypeIcon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{addr.nickname || addr.street}</p>
                      {addr.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-foreground/35">{svcCount} services · {formatCurrency(monthlyCost)}/mo</p>
                  </div>
                  <button
                    onClick={() => handlePdfReport(addr)}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-50 shrink-0"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF Report
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Full account PDF */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileDown className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Full Account Snapshot (PDF)</h3>
        </div>
        <div className="flex items-center gap-3 px-5 pb-5">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground/40">
              Single PDF with profile, subscription, every address with its services, moving plans, and task summary.
              Suitable for personal archive or audit hand-off.
            </p>
          </div>
          <button
            onClick={handleFullAccountPdf}
            disabled={generatingFullPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition disabled:opacity-50 shrink-0"
          >
            {generatingFullPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Data Exports */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Download className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground">Data Exports</h3>
        </div>
        <div className="px-5 pb-5 space-y-2">
          {exportOptions.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <div key={opt.title} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02]">
                <div className="p-2 rounded-lg bg-foreground/5 shrink-0">
                  <OptIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/80">{opt.title}</p>
                  <p className="text-[10px] text-foreground/35">{opt.description}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {opt.formats.map((fmt) => {
                    const key = `${opt.type}-${fmt}`;
                    const isLoading = downloading === key;
                    return (
                      <button
                        key={fmt}
                        disabled={isLoading}
                        onClick={() => handleExport(opt.type, fmt)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}{fmt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
