"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, FileText, FileSpreadsheet, Loader2, Home, Briefcase, Palmtree, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface AddressInfo {
  id: string; type: string; nickname?: string; street: string; city: string; state: string; zip: string; isPrimary: boolean; ownership: string; startDate: string;
  services?: { id: string; providerName: string; category: string; monthlyCost: number; billingDay?: number }[];
}

const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };
const categoryLabels: Record<string, string> = {
  GOVERNMENT: "Government", UTILITY: "Utilities", FINANCIAL: "Financial", HOUSING: "Housing",
  HEALTHCARE: "Healthcare", TRANSPORTATION: "Transport", KIDS: "Kids & Edu", FITNESS: "Fitness",
  SHOPPING: "Shopping", OTHER: "Other",
};

const exportOptions = [
  { title: "Addresses", description: "Export all addresses with details", icon: FileText, type: "addresses", formats: ["CSV", "JSON"] },
  { title: "Services", description: "Export all services and billing info", icon: FileSpreadsheet, type: "services", formats: ["CSV", "JSON"] },
  { title: "Budget History", description: "Export monthly budget data", icon: FileSpreadsheet, type: "budget", formats: ["CSV", "JSON"] },
  { title: "Moving Plans", description: "Export plans with tasks and boxes", icon: FileText, type: "moving", formats: ["JSON"] },
  { title: "Full Data Export", description: "Export all your data (GDPR compliant)", icon: Download, type: "full", formats: ["JSON"] },
];

function generatePDF(address: AddressInfo, userName: string) {
  const services = address.services || [];
  const totalMonthlyCost = services.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Group by category prefix
  const grouped: Record<string, typeof services> = {};
  for (const s of services) {
    const prefix = s.category.split("_")[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(s);
  }

  // Build HTML for PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
    .logo-text { font-size: 20px; font-weight: 700; background: linear-gradient(90deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .report-date { text-align: right; color: #64748b; font-size: 13px; }
    .report-title { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .report-subtitle { font-size: 14px; color: #64748b; margin-bottom: 24px; }
    .address-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .address-name { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .address-detail { font-size: 13px; color: #64748b; margin-bottom: 2px; }
    .stats-row { display: flex; gap: 24px; margin-top: 12px; }
    .stat { text-align: center; }
    .stat-value { font-size: 20px; font-weight: 700; color: #8b5cf6; }
    .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 14px; font-weight: 600; color: #475569; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .td-cost { text-align: right; font-weight: 600; color: #059669; }
    .td-day { text-align: center; color: #64748b; }
    .total-row { background: #f0fdf4; }
    .total-row td { font-weight: 700; font-size: 14px; border-bottom: none; border-top: 2px solid #059669; }
    .category-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .bar-label { font-size: 12px; color: #475569; width: 100px; }
    .bar-bg { flex: 1; height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 6px; }
    .bar-value { font-size: 12px; font-weight: 600; color: #475569; width: 80px; text-align: right; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 11px; }
    .cat-utility .bar-fill { background: #f59e0b; }
    .cat-financial .bar-fill { background: #10b981; }
    .cat-housing .bar-fill { background: #0ea5e9; }
    .cat-healthcare .bar-fill { background: #f43f5e; }
    .cat-government .bar-fill { background: #ef4444; }
    .cat-transportation .bar-fill { background: #3b82f6; }
    .cat-kids .bar-fill { background: #a855f7; }
    .cat-fitness .bar-fill { background: #f97316; }
    .cat-shopping .bar-fill { background: #ec4899; }
    .cat-other .bar-fill { background: #6b7280; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">L</div>
        <div class="logo-text">LocateFlow</div>
      </div>
      <div class="report-date">
        <div style="font-weight: 600; color: #1e293b;">Monthly Expense Report</div>
        <div>${monthYear}</div>
        <div>Generated: ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
      </div>
    </div>

    <div class="report-title">${address.nickname || address.street}</div>
    <div class="report-subtitle">${address.street}, ${address.city}, ${address.state} ${address.zip}</div>

    <div class="address-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="address-detail"><strong>Type:</strong> ${address.type} · <strong>Ownership:</strong> ${address.ownership === "OWNER" ? "Owner" : "Renter"}</div>
          <div class="address-detail"><strong>Move-in:</strong> ${new Date(address.startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          <div class="address-detail"><strong>Prepared for:</strong> ${userName || "Account Holder"}</div>
        </div>
        <div class="stats-row">
          <div class="stat">
            <div class="stat-value">${services.length}</div>
            <div class="stat-label">Services</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totalMonthlyCost.toLocaleString()}</div>
            <div class="stat-label">Monthly</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${(totalMonthlyCost * 12).toLocaleString()}</div>
            <div class="stat-label">Annual Est.</div>
          </div>
        </div>
      </div>
    </div>

    ${Object.keys(grouped).length > 0 ? `
    <div class="section-title">Category Breakdown</div>
    ${Object.entries(grouped).sort((a, b) => {
      const aTotal = a[1].reduce((s, sv) => s + (sv.monthlyCost || 0), 0);
      const bTotal = b[1].reduce((s, sv) => s + (sv.monthlyCost || 0), 0);
      return bTotal - aTotal;
    }).map(([prefix, svcs]) => {
      const catTotal = svcs.reduce((s, sv) => s + (sv.monthlyCost || 0), 0);
      const pct = totalMonthlyCost > 0 ? (catTotal / totalMonthlyCost) * 100 : 0;
      return `
      <div class="category-bar cat-${prefix.toLowerCase()}">
        <div class="bar-label">${categoryLabels[prefix] || prefix}</div>
        <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%"></div></div>
        <div class="bar-value">$${catTotal.toLocaleString()} (${Math.round(pct)}%)</div>
      </div>`;
    }).join("")}
    ` : ""}

    <div class="section-title">Service Details</div>
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Category</th>
          <th style="text-align: center">Bill Day</th>
          <th style="text-align: right">Monthly Cost</th>
        </tr>
      </thead>
      <tbody>
        ${services.sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0)).map((s) => `
        <tr>
          <td><strong>${s.providerName}</strong></td>
          <td>${(s.category || "").replace(/_/g, " ")}</td>
          <td class="td-day">${s.billingDay ? `Day ${s.billingDay}` : "—"}</td>
          <td class="td-cost">$${(s.monthlyCost || 0).toLocaleString()}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td colspan="3"><strong>Total Monthly Expenses</strong></td>
          <td class="td-cost">$${totalMonthlyCost.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>LocateFlow — Relocation Management Platform</div>
      <div>Page 1 of 1 · Confidential</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [userName, setUserName] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/addresses").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([addrData, profData]) => {
      setAddresses(addrData.addresses || []);
      if (profData.user) {
        setUserName(`${profData.user.firstName || ""} ${profData.user.lastName || ""}`.trim());
      }
    }).catch(() => {}).finally(() => setLoadingAddresses(false));
  }, []);

  const handleExport = async (type: string, format: string) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    try {
      const res = await fetch(`/api/export?type=${type}&format=${format.toLowerCase()}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `locateflow-${type}-export.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${type} exported as ${format}!`);
    } catch {
      toast.error("Export failed. Please try again.");
    }
    setDownloading(null);
  };

  const handlePdfReport = async (address: AddressInfo) => {
    setGeneratingPdf(address.id);
    try {
      const html = generatePDF(address, userName);
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast.error("Pop-up blocked. Please allow pop-ups."); return; }
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      toast.success("PDF report opened — use Print to save as PDF");
    } catch {
      toast.error("Failed to generate report");
    }
    setGeneratingPdf(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Export & Reports</h1>
          <p className="text-sm text-white/40">Download reports and export your data</p>
        </div>
      </div>

      {/* PDF Monthly Reports */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileText className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Monthly Expense Reports (PDF)</h3>
        </div>
        <p className="text-xs text-white/30 px-5 pb-3">
          Generate a professional PDF report for any address with company branding, category breakdown, and full service details.
        </p>
        <div className="px-5 pb-5 space-y-2">
          {loadingAddresses ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-4">No addresses to generate reports for</p>
          ) : (
            addresses.map((addr) => {
              const TypeIcon = typeIcons[addr.type] || MapPin;
              const svcCount = addr.services?.length || 0;
              const monthlyCost = addr.services?.reduce((sum, s) => sum + (s.monthlyCost || 0), 0) || 0;
              const isGenerating = generatingPdf === addr.id;
              return (
                <div key={addr.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition">
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
                    <TypeIcon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{addr.nickname || addr.street}</p>
                      {addr.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-white/25">{svcCount} services · {formatCurrency(monthlyCost)}/mo</p>
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

      {/* Data Exports */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Download className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Data Exports</h3>
        </div>
        <div className="px-5 pb-5 space-y-2">
          {exportOptions.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <div key={opt.title} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="p-2 rounded-lg bg-white/5 shrink-0">
                  <OptIcon className="h-4 w-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/70">{opt.title}</p>
                  <p className="text-[10px] text-white/25">{opt.description}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {opt.formats.map((fmt) => {
                    const key = `${opt.type}-${fmt}`;
                    const isLoading = downloading === key;
                    return (
                      <button key={fmt} disabled={isLoading} onClick={() => handleExport(opt.type, fmt)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition disabled:opacity-50">
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
