"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAddressAutocompleteSessionToken,
  type AddressAutocompletePrediction,
  type AddressAutocompleteResult,
  type AddressAutocompleteSearchResponse,
  type AddressAutocompleteDetailsResponse,
} from "@/lib/shared-address-autocomplete";

const GOOGLE_POWERED_BY_SRC = "https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png";

interface AddressAutocompleteInputProps {
  id?: string;
  label?: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  onValueChange: (value: string) => void;
  onSelect: (result: AddressAutocompleteResult) => void;
  onManualChange?: () => void;
}

export function AddressAutocompleteInput({
  id,
  label,
  value,
  placeholder,
  required,
  disabled,
  hint,
  onValueChange,
  onSelect,
  onManualChange,
}: AddressAutocompleteInputProps) {
  const sessionTokenRef = useRef(createAddressAutocompleteSessionToken());
  const skipNextQueryRef = useRef<string | null>(null);
  const [predictions, setPredictions] = useState<AddressAutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const query = value.trim();
    if (skipNextQueryRef.current && skipNextQueryRef.current === query) {
      skipNextQueryRef.current = null;
      setPredictions([]);
      setOpen(false);
      return;
    }
    if (query.length < 3) {
      setPredictions([]);
      return;
    }
    if (!enabled) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          input: query,
          sessionToken: sessionTokenRef.current,
        });
        const response = await fetch(`/api/address-autocomplete?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to search addresses");
        }
        const data = (await response.json()) as AddressAutocompleteSearchResponse;
        setEnabled(data.enabled !== false);
        setPredictions(data.predictions || []);
        setOpen((data.predictions || []).length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPredictions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [value, enabled]);

  async function handleSelect(prediction: AddressAutocompletePrediction) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        placeId: prediction.placeId,
        sessionToken: sessionTokenRef.current,
      });
      const response = await fetch(`/api/address-autocomplete/details?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to resolve address");
      }
      const data = (await response.json()) as AddressAutocompleteDetailsResponse;
      if (!data.result) {
        return;
      }
      skipNextQueryRef.current = data.result.street || prediction.primaryText;
      onSelect(data.result);
      setPredictions([]);
      setOpen(false);
      sessionTokenRef.current = createAddressAutocompleteSessionToken();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onFocus={() => setOpen(predictions.length > 0)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onValueChange(event.target.value);
            onManualChange?.();
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <MapPin className="h-4 w-4" /> : null}
        </div>
        {open && predictions.length > 0 ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
            <div className="max-h-56 overflow-y-auto">
              {predictions.map((prediction) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  className="flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleSelect(prediction)}
                >
                  <span className="text-sm font-medium text-foreground">{prediction.primaryText}</span>
                  <span className="text-xs text-muted-foreground">{prediction.secondaryText || prediction.description}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-border bg-white px-3 py-2">
              <img
                src={GOOGLE_POWERED_BY_SRC}
                alt="Powered by Google"
                className="h-[15px] w-[120px]"
              />
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {hint || (enabled ? "Start typing for address suggestions, or continue manually." : "Address suggestions are unavailable. Continue manually.")}
      </p>
    </div>
  );
}
