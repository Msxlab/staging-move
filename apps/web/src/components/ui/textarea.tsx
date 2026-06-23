import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Marks the field invalid: sets aria-invalid and a destructive focus ring so
      the error state is conveyed to assistive tech, not by color alone. Pair
      with aria-describedby pointing at the visible error message. */
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = ariaInvalid ?? (error ? true : undefined);
    return (
      <textarea
        aria-invalid={invalid}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
