'use client';

import { cn } from "@/lib/utils";
import { useState } from "react";

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Standard labeled text input for all LocateFlow forms — address line,
 * service name, amount, provider contact. The label floats up on focus or
 * when the field has a value. Zero npm deps; themed via our CSS vars.
 */
export function FloatingInput({ label, className, ...props }: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(
    props.value != null ? String(props.value) !== "" : Boolean(props.defaultValue)
  );

  return (
    <div className="relative">
      <input
        className={cn(
          "peer w-full px-4 py-3 border rounded-lg bg-transparent text-foreground outline-none",
          "border-border focus:border-primary transition-colors",
          "placeholder:text-transparent",
          className
        )}
        placeholder=" "
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          setHasValue(e.target.value !== "");
        }}
        onChange={(e) => {
          setHasValue(e.target.value !== "");
          props.onChange?.(e);
        }}
        {...props}
      />
      <label
        className={cn(
          "absolute left-4 top-3 text-muted-foreground transition-all duration-200 pointer-events-none",
          "peer-focus:-top-2.5 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-card peer-focus:px-1",
          "peer-focus:text-primary",
          (focused || hasValue) && "-top-2.5 left-3 text-xs bg-card px-1"
        )}
      >
        {label}
      </label>
    </div>
  );
}
