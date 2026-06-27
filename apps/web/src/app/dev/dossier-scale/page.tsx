"use client";

import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/i18n/messages/en.json";
import { scoreForAir, scoreForFlood, scoreForWeather, type DossierScaleResult } from "@locateflow/shared";
import { DossierScaleCard } from "@/components/dashboard/dossier-scale-card";

/**
 * Dev-only, no-auth preview for the DossierScale pilot (Task 4, live preview).
 * Renders the real DossierScaleCard for air / weather / flood across all five
 * levels using the real scoreFor* mapper and sample source values. No Lottie
 * assets yet, so the character stage is intentionally empty (graceful) — this
 * previews the 5-segment scale + data number + narration + honest levels.
 * URL: /dev/dossier-scale
 */

const AIR: { title: string; result: DossierScaleResult }[] = [
  { title: "Air quality", result: scoreForAir({ aqi: 30 }) },
  { title: "Air quality", result: scoreForAir({ aqi: 75 }) },
  { title: "Air quality", result: scoreForAir({ aqi: 130 }) },
  { title: "Air quality", result: scoreForAir({ aqi: 180 }) },
  { title: "Air quality", result: scoreForAir({ aqi: 260 }) },
];

const WEATHER: { title: string; result: DossierScaleResult }[] = [
  { title: "Moving-day weather", result: scoreForWeather({ summary: "Sunny", precipChancePct: 0, tempHighF: 72, tempLowF: 55 }) },
  { title: "Moving-day weather", result: scoreForWeather({ summary: "Cloudy", precipChancePct: 40, tempHighF: 68, tempLowF: 52 }) },
  { title: "Moving-day weather", result: scoreForWeather({ summary: "Light rain", precipChancePct: 20, tempHighF: 60, tempLowF: 50 }) },
  { title: "Moving-day weather", result: scoreForWeather({ summary: "Heavy rain", precipChancePct: 90, tempHighF: 58, tempLowF: 48 }) },
  { title: "Moving-day weather", result: scoreForWeather({ summary: "Snowstorm", precipChancePct: 90, tempHighF: 28, tempLowF: 15 }) },
];

const FLOOD: { title: string; result: DossierScaleResult }[] = [
  { title: "Flood zone", result: scoreForFlood({ zone: "X", isHighRisk: false }) },
  { title: "Flood zone", result: scoreForFlood({ zone: "AO", isHighRisk: true }) },
  { title: "Flood zone", result: scoreForFlood({ zone: "AE", isHighRisk: true }) },
  { title: "Flood zone", result: scoreForFlood({ zone: "VE", isHighRisk: true }) },
];

function Row({ heading, items }: { heading: string; items: { title: string; result: DossierScaleResult }[] }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, i) => (
          <DossierScaleCard key={i} title={item.title} result={item.result} />
        ))}
      </div>
    </section>
  );
}

export default function DossierScalePreviewPage() {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="light min-h-screen w-full bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <header className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-foreground">DossierScale pilot — 5-level cards</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Live preview of the real DossierScaleCard for air, weather, and flood across every level, from the
              scoreFor mapper. Lottie character assets are not wired yet, so the stage is intentionally empty — this
              previews the uniform 5-segment scale, the data number, and the bolder-funny→respectful narration. Flood
              naturally lands on fewer than 5 levels (honest mapping).
            </p>
          </header>
          <Row heading="Air quality — AQI 30 / 75 / 130 / 180 / 260" items={AIR} />
          <Row heading="Moving-day weather — clear → severe" items={WEATHER} />
          <Row heading="Flood zone — X / AO / AE / VE (honest levels)" items={FLOOD} />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
