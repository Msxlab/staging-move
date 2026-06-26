# Dossier Lottie assets — authoring convention

These Lottie files drive the `DossierScaleCard` character stage. They are
**authored in Adobe After Effects** and exported via Bodymovin (this is the
pro "Adobe → app" path). See the design spec:
`docs/superpowers/specs/2026-06-26-dossier-scale-design.md`.

## Files (pilot)
- `air.lottie` (or `air.json`)
- `weather.lottie`
- `flood.lottie`

## Segment-per-level convention
Each file contains **5 level segments** along its timeline. The
`scoreFor*` mapper in `@locateflow/shared` returns a `level` (1–5); the caller
maps that level to a frame range and passes it to `DossierLottieStage` as
`segment={[startFrame, endFrame]}`.

Define the per-file frame ranges next to the card wiring, e.g.:

```ts
const LOTTIE_SEGMENTS: Record<string, Record<1|2|3|4|5, [number, number]>> = {
  air:     { 1: [0, 30], 2: [30, 60], 3: [60, 90], 4: [90, 120], 5: [120, 150] },
  weather: { 1: [0, 30], 2: [30, 60], 3: [60, 90], 4: [90, 120], 5: [120, 150] },
  flood:   { 1: [0, 30], 2: [30, 60], 3: [60, 90], 4: [90, 120], 5: [120, 150] },
};
```

(Replace the placeholder ranges with the real marker frames from the AE comp.)

## Theming (sapphire)
Re-tint strokes/fills to the sapphire token palette at author time, or apply a
Lottie `colorFilters` map at runtime keyed to the design tokens — never ship a
hardcoded brand colour.

## Tone
Animation character follows the spec's tone: bolder/funny at benign levels,
calm and respectful at serious levels (flood/hazard/radon high).

## Until assets land
`DossierLottieStage` renders a graceful empty stage when no `data` is passed, so
`DossierScaleCard` works (number + 5-segment scale + narration) before these
files exist. Wire each file in by importing the JSON and passing it as
`lottieData` with the matching `segment`.
