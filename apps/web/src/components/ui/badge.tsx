import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-white",
        warning: "border-transparent bg-warning text-white",
        info: "border-transparent bg-info text-white",
        // Aurora tonal badges (design lf-badge--*): soft tone fill, matching
        // hairline border, tone ink. Track light/dark via the tone-* vars.
        rose: "border-tone-rose-br bg-tone-rose-bg text-tone-rose-fg",
        foil: "border-tone-foil-br bg-tone-foil-bg text-tone-foil-fg",
        sage: "border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg",
        honey: "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg",
        danger: "border-danger bg-danger-light text-danger",
        // Plan badges: Individual and Pro resolve to Sapphire; Family keeps
        // its workspace teal. proSolid is the Sapphire foil fill for upgrade moments.
        individual: "border-tone-rose-br bg-tone-rose-bg text-tone-rose-fg",
        family:
          "border-[color:var(--tone-family-br)] bg-[color:var(--tone-family-bg)] text-[color:var(--tone-family-fg)]",
        pro: "border-tone-foil-br bg-tone-foil-bg text-tone-foil-fg",
        proSolid: "border-transparent bg-foil font-bold text-[#0A0F18]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "rose"
  | "foil"
  | "sage"
  | "honey"
  | "danger"
  | "individual"
  | "family"
  | "pro"
  | "proSolid";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
