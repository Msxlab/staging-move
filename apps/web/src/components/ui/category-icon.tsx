import {
  Baby,
  Car,
  ClipboardList,
  CreditCard,
  Dumbbell,
  HeartPulse,
  Home,
  Landmark,
  Scale,
  ShoppingCart,
  Store,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  GOVERNMENT: Landmark,
  UTILITY: Zap,
  FINANCIAL: CreditCard,
  HOUSING: Home,
  HEALTHCARE: HeartPulse,
  TRANSPORTATION: Car,
  KIDS: Baby,
  FITNESS: Dumbbell,
  SHOPPING: ShoppingCart,
  GROCERY: Store,
  PET: HeartPulse,
  LEGAL: Scale,
  OTHER: ClipboardList,
};

function categoryPrefix(category?: string | null): string {
  return (category || "OTHER").split("_")[0].toUpperCase();
}

export function categoryIconFor(category?: string | null): LucideIcon {
  return CATEGORY_ICON_MAP[categoryPrefix(category)] || ClipboardList;
}

export function CategoryIcon({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  const Icon = categoryIconFor(category);
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}
