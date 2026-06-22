/**
 * RaccoonMark (mobile) — the official LocateFlow brand mark.
 *
 * The mobile UI catalog already ships a faithful react-native-svg port of the
 * parametric raccoon (`components/move/MoveRaccoon.tsx`), theme-bound through
 * `useAppTheme().colors.raccoon` with the eye on the active accent. Rather than
 * duplicate that geometry, this module re-exports it under the canonical
 * `RaccoonMark` name so brand call sites can import from a single, predictable
 * `components/brand/` path across web + mobile.
 *
 * Same props (`size`, `mood`, plus per-paint `head`/`mask`/`ear`/`eye`/`pupil`
 * overrides) and the same five moods (`calm | alert | happy | thinking |
 * approved`).
 */
export {
  MoveRaccoon as RaccoonMark,
  MoveRaccoon,
  type RaccoonMood,
  type RaccoonMood as RaccoonMarkMood,
} from "@/components/move/MoveRaccoon";

export { MoveRaccoon as default } from "@/components/move/MoveRaccoon";
