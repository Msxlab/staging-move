import {
  planColors,
  semanticColorsLight,
  surfaceLight,
  tonesLight,
} from "@locateflow/shared";
import { describe, expect, it } from "vitest";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Rgba = Rgb & {
  a: number;
};

const AA_NORMAL_TEXT = 4.5;

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function parseRgba(value: string): Rgba {
  const match = value.match(
    /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0?\.\d+|1(?:\.0+)?)\s*\)$/,
  );

  if (!match) {
    throw new Error(`Unsupported rgba token: ${value}`);
  }

  return {
    r: Number.parseInt(match[1]!, 10),
    g: Number.parseInt(match[2]!, 10),
    b: Number.parseInt(match[3]!, 10),
    a: Number.parseFloat(match[4]!),
  };
}

function blend(foreground: Rgba, background: Rgb): Rgb {
  return {
    r: Math.round(foreground.r * foreground.a + background.r * (1 - foreground.a)),
    g: Math.round(foreground.g * foreground.a + background.g * (1 - foreground.a)),
    b: Math.round(foreground.b * foreground.a + background.b * (1 - foreground.a)),
  };
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function expectAaContrast(label: string, foregroundHex: string, background: Rgb): void {
  const ratio = contrastRatio(hexToRgb(foregroundHex), background);
  expect(ratio, label).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
}

describe("light design tokens", () => {
  const paperSurfaces = [
    ["background", surfaceLight.background],
    ["card", surfaceLight.card],
    ["cardHover", surfaceLight.cardHover],
  ] as const;

  it("keep tonal chip text at WCAG AA contrast on light surfaces", () => {
    for (const [surfaceName, surfaceHex] of paperSurfaces) {
      const surface = hexToRgb(surfaceHex);

      for (const [toneName, tone] of Object.entries(tonesLight)) {
        const toneBackground = blend(parseRgba(tone.bg), surface);
        expectAaContrast(`${toneName} on ${surfaceName}`, tone.text, toneBackground);
      }
    }
  });

  it("keeps plan accent text at WCAG AA contrast on subtle light plan fills", () => {
    const card = hexToRgb(surfaceLight.card);

    for (const [planName, plan] of Object.entries(planColors)) {
      const accent = hexToRgb(plan.light);
      const subtlePlanFill = blend({ ...accent, a: 0.05 }, card);
      expectAaContrast(`${planName} plan accent`, plan.light, subtlePlanFill);
    }
  });

  it("keeps light semantic text at WCAG AA contrast on its own soft fill", () => {
    const card = hexToRgb(surfaceLight.card);
    const semanticPairs = [
      ["success", semanticColorsLight.success, semanticColorsLight.successLight],
      ["warning", semanticColorsLight.warning, semanticColorsLight.warningLight],
      ["danger", semanticColorsLight.danger, semanticColorsLight.dangerLight],
      ["info", semanticColorsLight.info, semanticColorsLight.infoLight],
    ] as const;

    for (const [name, foreground, softBackground] of semanticPairs) {
      expectAaContrast(name, foreground, blend(parseRgba(softBackground), card));
    }
  });
});
