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
import { useLocale } from "next-intl";
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

const EXPORT_COPY = {
  en: {
    back: "Back",
    title: "Export & Reports",
    subtitle: "Download reports and export your data",
    confirmPassword: "Confirm password",
    passwordPlaceholder: "Password",
    monthlyReports: "Monthly Expense Reports (PDF)",
    monthlyReportsBody: "Pick the address you want a monthly report for. Each PDF is generated on the server with branding, category breakdown, and full service details — no print dialog needed.",
    noAddresses: "No addresses to generate reports for",
    services: "services",
    pdfReport: "PDF Report",
    fullSnapshot: "Full Account Snapshot (PDF)",
    fullSnapshotBody: "Single PDF with profile, subscription, every address with its services, moving plans, and task summary. Suitable for personal archive or audit hand-off.",
    taxReport: "Tax & Property Report (PDF) · Pro",
    taxReportBody: "Per-property summary with occupancy, service counts, monthly-equivalent and annualized costs, and a grand total — formatted for tax prep. Includes a \"not tax advice\" disclaimer.",
    downloadPdf: "Download PDF",
    dataExports: "Data Exports",
    downloadFailed: "Download failed",
    exportFailed: "Export failed",
    pdfDownloaded: "PDF report downloaded",
    pdfFailed: "Failed to generate report",
    fullPdfDownloaded: "Full account PDF downloaded",
    fullPdfFailed: "Failed to generate PDF",
    taxPdfDownloaded: "Tax & property PDF downloaded",
    taxPdfFailed: "Failed to generate PDF",
    exportedAs: (type: string, format: string) => `${type} exported as ${format}`,
    options: [
      { title: "Addresses", description: "Export all addresses with details", icon: FileText, type: "addresses", formats: ["CSV", "JSON"] },
      { title: "Services", description: "Export all services and billing info", icon: FileSpreadsheet, type: "services", formats: ["CSV", "JSON"] },
      { title: "Budget History", description: "Export monthly budget data", icon: FileSpreadsheet, type: "budget", formats: ["CSV", "JSON"] },
      { title: "Moving Plans", description: "Export plans with tasks and boxes", icon: FileText, type: "moving", formats: ["JSON"] },
      { title: "Tax & Property Export", description: "Per-property summary for tax prep — annualized service costs + move history (Pro)", icon: FileDown, type: "tax", formats: ["CSV", "JSON"] },
      { title: "Full Data Export", description: "Export supported account data", icon: Download, type: "full", formats: ["JSON"] },
    ],
  },
  es: {
    back: "Volver",
    title: "Exportar e informes",
    subtitle: "Descarga informes y exporta tus datos",
    confirmPassword: "Confirmar contrasena",
    passwordPlaceholder: "Contrasena",
    monthlyReports: "Informes mensuales de gastos (PDF)",
    monthlyReportsBody: "Elige la direccion para generar un informe mensual. Cada PDF se crea en el servidor con branding, desglose por categoria y detalles completos de servicios, sin dialogo de impresion.",
    noAddresses: "No hay direcciones para generar informes",
    services: "servicios",
    pdfReport: "Informe PDF",
    fullSnapshot: "Snapshot completo de cuenta (PDF)",
    fullSnapshotBody: "PDF unico con perfil, suscripcion, direcciones, servicios, planes de mudanza y resumen de tareas. Ideal para archivo personal o auditoria.",
    taxReport: "Informe fiscal y de propiedad (PDF) · Pro",
    taxReportBody: "Resumen por propiedad con ocupacion, servicios, costos mensuales equivalentes, costos anualizados y total general. Incluye aviso de que no es asesoria fiscal.",
    downloadPdf: "Descargar PDF",
    dataExports: "Exportaciones de datos",
    downloadFailed: "No se pudo descargar",
    exportFailed: "No se pudo exportar",
    pdfDownloaded: "Informe PDF descargado",
    pdfFailed: "No se pudo generar el informe",
    fullPdfDownloaded: "PDF completo de cuenta descargado",
    fullPdfFailed: "No se pudo generar el PDF",
    taxPdfDownloaded: "PDF fiscal y de propiedad descargado",
    taxPdfFailed: "No se pudo generar el PDF",
    exportedAs: (type: string, format: string) => `${type} exportado como ${format}`,
    options: [
      { title: "Direcciones", description: "Exporta todas las direcciones con detalles", icon: FileText, type: "addresses", formats: ["CSV", "JSON"] },
      { title: "Servicios", description: "Exporta servicios e informacion de facturacion", icon: FileSpreadsheet, type: "services", formats: ["CSV", "JSON"] },
      { title: "Historial de presupuesto", description: "Exporta datos mensuales de presupuesto", icon: FileSpreadsheet, type: "budget", formats: ["CSV", "JSON"] },
      { title: "Planes de mudanza", description: "Exporta planes con tareas y cajas", icon: FileText, type: "moving", formats: ["JSON"] },
      { title: "Export fiscal y propiedad", description: "Resumen por propiedad para impuestos: costos anualizados e historial de mudanza (Pro)", icon: FileDown, type: "tax", formats: ["CSV", "JSON"] },
      { title: "Export completo", description: "Exporta los datos soportados de la cuenta", icon: Download, type: "full", formats: ["JSON"] },
    ],
  },
} as const;

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? EXPORT_COPY.es : EXPORT_COPY.en;
}

/**
 * Hit `url`, save the response as a download. Reads the filename from
 * `Content-Disposition` so the server controls naming, and surfaces a
 * JSON `error` message when the API rejects the request.
 */
async function downloadFromUrl(url: string, fallbackFilename: string, init?: RequestInit): Promise<void> {
  const res = await fetch(url, { cache: "no-store", ...init });
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
  const locale = useLocale();
  const copy = copyForLocale(locale);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingFullPdf, setGeneratingFullPdf] = useState(false);
  const [generatingTaxPdf, setGeneratingTaxPdf] = useState(false);
  const [exportPassword, setExportPassword] = useState("");

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
        "/api/export",
        `locateflow-${type}-export.${format.toLowerCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            format: format.toLowerCase(),
            confirmPassword: exportPassword,
          }),
        },
      );
      toast.success(copy.exportedAs(type, format));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.exportFailed);
    }
    setDownloading(null);
  };

  // Per-address monthly expense PDF — produced server-side by pdfkit.
  // No more pop-up window or print dialog dependency.
  const handlePdfReport = async (address: AddressInfo) => {
    setGeneratingPdf(address.id);
    try {
      await downloadFromUrl(
        "/api/export/pdf",
        `locateflow-${address.nickname || address.street}-report.pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "address",
            addressId: address.id,
            confirmPassword: exportPassword,
          }),
        },
      );
      toast.success(copy.pdfDownloaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.pdfFailed);
    }
    setGeneratingPdf(null);
  };

  // Full-account snapshot PDF — profile, subscription, addresses,
  // services, moving plans, task summary in a single document.
  const handleFullAccountPdf = async () => {
    setGeneratingFullPdf(true);
    try {
      await downloadFromUrl(
        "/api/export/pdf",
        "locateflow-account-snapshot.pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "full",
            confirmPassword: exportPassword,
          }),
        },
      );
      toast.success(copy.fullPdfDownloaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.fullPdfFailed);
    }
    setGeneratingFullPdf(false);
  };

  // Tax & property PDF — per-property summary (Pro). The server 403s non-Pro
  // with a clear message that downloadFromUrl surfaces as a toast.
  const handleTaxPdf = async () => {
    setGeneratingTaxPdf(true);
    try {
      await downloadFromUrl(
        "/api/export/pdf",
        "locateflow-tax-property-report.pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "tax", confirmPassword: exportPassword }),
        },
      );
      toast.success(copy.taxPdfDownloaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.taxPdfFailed);
    }
    setGeneratingTaxPdf(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />{copy.back}
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl px-5 py-4">
        <label htmlFor="export-password" className="mb-1 block text-xs font-medium text-muted-foreground">
          {copy.confirmPassword}
        </label>
        <input
          id="export-password"
          type="password"
          autoComplete="current-password"
          value={exportPassword}
          onChange={(event) => setExportPassword(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={copy.passwordPlaceholder}
        />
      </div>

      {/* Per-address PDF reports */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileText className="h-4 w-4 text-tone-orange-fg" />
          <h3 className="text-sm font-semibold text-foreground">{copy.monthlyReports}</h3>
        </div>
        <p className="text-xs text-foreground/40 px-5 pb-3">
          {copy.monthlyReportsBody}
        </p>
        <div className="px-5 pb-5 space-y-2">
          {loadingAddresses ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-tone-orange-fg" />
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-4">{copy.noAddresses}</p>
          ) : (
            addresses.map((addr) => {
              const TypeIcon = typeIcons[addr.type] || MapPin;
              const svcCount = addr.services?.length || 0;
              const monthlyCost = addr.services?.reduce((sum, s) => sum + (s.monthlyCost || 0), 0) || 0;
              const isGenerating = generatingPdf === addr.id;
              return (
                <div key={addr.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition">
                  <div className="p-2 rounded-lg bg-tone-orange-bg border border-tone-orange-br shrink-0">
                    <TypeIcon className="h-4 w-4 text-tone-orange-fg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{addr.nickname || addr.street}</p>
                      {addr.isPrimary && <Star className="h-3 w-3 text-tone-honey-fg fill-warning shrink-0" />}
                    </div>
                    <p className="text-[10px] text-foreground/35">{svcCount} {copy.services} · {formatCurrency(monthlyCost)}/mo</p>
                  </div>
                  <button
                    onClick={() => handlePdfReport(addr)}
                    disabled={isGenerating || !exportPassword}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50 shrink-0"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {copy.pdfReport}
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
          <FileDown className="h-4 w-4 text-tone-honey-fg" />
          <h3 className="text-sm font-semibold text-foreground">{copy.fullSnapshot}</h3>
        </div>
        <div className="flex items-center gap-3 px-5 pb-5">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground/40">
              {copy.fullSnapshotBody}
            </p>
          </div>
          <button
            onClick={handleFullAccountPdf}
            disabled={generatingFullPdf || !exportPassword}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-honey-fg text-white text-xs font-medium hover:bg-tone-honey-fg/80 transition disabled:opacity-50 shrink-0"
          >
            {generatingFullPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {copy.downloadPdf}
          </button>
        </div>
      </div>

      {/* Tax & Property Report (PDF) — Pro */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileDown className="h-4 w-4 text-tone-honey-fg" />
          <h3 className="text-sm font-semibold text-foreground">{copy.taxReport}</h3>
        </div>
        <div className="flex items-center gap-3 px-5 pb-5">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground/40">
              {copy.taxReportBody}
            </p>
          </div>
          <button
            onClick={handleTaxPdf}
            disabled={generatingTaxPdf || !exportPassword}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-honey-fg text-white text-xs font-medium hover:bg-tone-honey-fg/80 transition disabled:opacity-50 shrink-0"
          >
            {generatingTaxPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {copy.downloadPdf}
          </button>
        </div>
      </div>

      {/* Data Exports */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Download className="h-4 w-4 text-tone-cyan-fg" />
          <h3 className="text-sm font-semibold text-foreground">{copy.dataExports}</h3>
        </div>
        <div className="px-5 pb-3">
          <label htmlFor="data-export-password" className="mb-1 block text-xs font-medium text-muted-foreground">
            {copy.confirmPassword}
          </label>
          <input
            id="data-export-password"
            type="password"
            autoComplete="current-password"
            value={exportPassword}
            onChange={(event) => setExportPassword(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={copy.passwordPlaceholder}
          />
        </div>
        <div className="px-5 pb-5 space-y-2">
          {copy.options.map((opt) => {
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
                        disabled={isLoading || !exportPassword}
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
