import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "glass" opts into the Aurora frosted treatment (design lf-card--glass):
      var(--glass-bg) + backdrop blur, glass border, radius-2xl, shadow-xl.
      Unset renders the original card byte-for-byte. */
  variant?: "default" | "glass";
  /** Opts into the Aurora hover lift (design lf-card--hover): border to the
      cool line-rose tone + shadow-md + translateY(-1px) over 160ms. Static
      under prefers-reduced-motion. */
  hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === "glass"
          ? "glass-card text-card-foreground"
          : "rounded-lg border bg-card text-card-foreground shadow-sm",
        hover && "lf-card-hover",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Render as a different heading level so the document outline stays correct
      where a card sits under an existing h1/h2 — purely the element/role, the
      visual size is unchanged. Defaults to "h3" to preserve existing output. */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Convenience alias for `as` as a numeric level (e.g. level={2} → "h2"). */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as, level, ...props }, ref) => {
    const Heading = (as ?? (level ? (`h${level}` as const) : "h3")) as "h3";
    return (
      <Heading ref={ref} className={cn("text-2xl font-semibold leading-none", className)} {...props} />
    );
  }
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
