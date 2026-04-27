"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Receipt, Calendar, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface BillService {
  id: string;
  providerName: string;
  category: string;
  monthlyCost: number;
  billingDay: number;
  address?: { nickname?: string; city?: string };
}

function getDaysUntilBill(billingDay: number): number {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  if (billingDay >= currentDay) {
    return billingDay - currentDay;
  }
  return daysInMonth - currentDay + billingDay;
}

function getBillStatus(
  daysUntil: number,
  td: ReturnType<typeof useTranslations>
): { label: string; color: string; icon: React.ElementType } {
  if (daysUntil === 0) return { label: td("bills_dueToday"), color: "text-red-400", icon: AlertTriangle };
  if (daysUntil <= 3) return { label: td("bills_dueIn", { days: daysUntil }), color: "text-amber-400", icon: Clock };
  if (daysUntil <= 7) return { label: td("bills_dueIn", { days: daysUntil }), color: "text-cyan-400", icon: Calendar };
  return { label: td("bills_dueIn", { days: daysUntil }), color: "text-foreground/40", icon: Calendar };
}

export function UpcomingBills() {
  const td = useTranslations("dashboard");
  const [bills, setBills] = useState<BillService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const services = (data.services || []) as BillService[];
        const withBilling = services
          .filter((s) => s.billingDay && s.billingDay > 0 && (s.monthlyCost || 0) > 0)
          .sort((a, b) => getDaysUntilBill(a.billingDay) - getDaysUntilBill(b.billingDay));
        setBills(withBilling.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcomingThisWeek = bills.filter((b) => getDaysUntilBill(b.billingDay) <= 7);
  const weekTotal = upcomingThisWeek.reduce((sum, b) => sum + (b.monthlyCost || 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">{td("widget_bills")}</h3>
        </div>
        {upcomingThisWeek.length > 0 && (
          <span className="text-xs font-semibold text-amber-400">
            {td("bills_thisWeek", { amount: formatCurrency(weekTotal) })}
          </span>
        )}
      </div>
      <div className="px-5 pb-5 space-y-1.5">
        {loading ? (
          <p className="text-sm text-foreground/40 text-center py-4">{td("bills_loading")}</p>
        ) : bills.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-6 w-6 text-foreground/20 mx-auto mb-1.5" />
            <p className="text-xs text-foreground/40">{td("bills_empty")}</p>
            <p className="text-[10px] text-foreground/30 mt-0.5">{td("bills_empty_hint")}</p>
          </div>
        ) : (
          bills.map((bill) => {
            const daysUntil = getDaysUntilBill(bill.billingDay);
            const status = getBillStatus(daysUntil, td);
            const StatusIcon = status.icon;
            return (
              <Link key={bill.id} href={`/services/${bill.id}`}>
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition group cursor-pointer">
                  <div className={`p-1.5 rounded-lg ${daysUntil <= 3 ? "bg-amber-500/10 border border-amber-500/20" : "bg-foreground/5"}`}>
                    <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{bill.providerName}</p>
                    <p className="text-[10px] text-foreground/35">
                      {td("bills_day", { day: bill.billingDay })}
                      {bill.address && ` · ${bill.address.nickname || bill.address.city}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-muted-foreground">{formatCurrency(bill.monthlyCost)}</p>
                    <p className={`text-[10px] font-medium ${status.color}`}>{status.label}</p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
