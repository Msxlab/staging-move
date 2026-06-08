import { create } from "zustand";
import type { ProviderCardData } from "@/components/provider/ProviderCard";

/**
 * Ephemeral, in-memory store for the provider "compare tray". The user
 * long-presses (or taps the compare control on) a provider card to add it,
 * then opens a side-by-side comparison screen. Capped at MAX_COMPARE so the
 * comparison stays readable and matches the server endpoint cap.
 *
 * This is intentionally NOT persisted — a comparison is a momentary decision
 * aid, not a saved list. (A persisted "shortlist" is a separate concern.)
 */
export const MAX_COMPARE = 4;

export type CompareEntry = ProviderCardData;

interface CompareState {
  entries: CompareEntry[];
  add: (provider: CompareEntry) => boolean;
  remove: (id: string) => void;
  toggle: (provider: CompareEntry) => boolean;
  clear: () => void;
  has: (id: string) => boolean;
  isFull: () => boolean;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  entries: [],
  add: (provider) => {
    const { entries } = get();
    if (entries.some((e) => e.id === provider.id)) return true;
    if (entries.length >= MAX_COMPARE) return false;
    set({ entries: [...entries, provider] });
    return true;
  },
  remove: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),
  toggle: (provider) => {
    const { entries } = get();
    if (entries.some((e) => e.id === provider.id)) {
      set({ entries: entries.filter((e) => e.id !== provider.id) });
      return false;
    }
    if (entries.length >= MAX_COMPARE) return false;
    set({ entries: [...entries, provider] });
    return true;
  },
  clear: () => set({ entries: [] }),
  has: (id) => get().entries.some((e) => e.id === id),
  isFull: () => get().entries.length >= MAX_COMPARE,
}));
