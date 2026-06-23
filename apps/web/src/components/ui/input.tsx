import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field invalid: sets aria-invalid and a destructive focus ring so
      the error state is conveyed to assistive tech, not by color alone. Pair
      with aria-describedby pointing at the visible error message. */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = ariaInvalid ?? (error ? true : undefined);
    return (
      <input
        type={type}
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
