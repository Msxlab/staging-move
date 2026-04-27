import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div className={cn("glass-card p-5 hover:bg-foreground/[0.07] transition-all", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {description && (
            <p className="text-[11px] text-foreground/40">{description}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.isPositive ? "+" : "-"}
              {Math.abs(trend.value)}% from last month
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Icon className="h-5 w-5 text-orange-400" />
        </div>
      </div>
    </div>
  );
}
