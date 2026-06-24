// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeDossier, type HomeDossierResponse } from "./home-dossier";

vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return {
    CloudSun: icon("cloud-sun"),
    Check: icon("check"),
    Compass: icon("compass"),
    Download: icon("download"),
    Droplets: icon("droplets"),
    FlaskConical: icon("flask-conical"),
    GraduationCap: icon("graduation-cap"),
    Home: icon("home"),
    MapPin: icon("map-pin"),
    Mountain: icon("mountain"),
    Sparkles: icon("sparkles"),
    Waves: icon("waves"),
    Wind: icon("wind"),
    Zap: icon("zap"),
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));

vi.mock("next-intl", () => {
  const t = (key: string, vars?: Record<string, unknown>) => {
    if (key === "dossier_title") return "Your new home dossier";
    if (key === "dossier_flood_low") return `Zone ${vars?.zone} — minimal flood risk`;
    if (key === "dossier_flood_title") return "Flood zone";
    if (key === "dossier_flood_disclaimer") return "Informational, from FEMA flood maps — not an insurance determination.";
    if (key === "dossier_flood_msc") return "msc.fema.gov";
    return key;
  };
  t.rich = (key: string) => key;
  return { useTranslations: () => t, useLocale: () => "en-US" };
});

const payload: HomeDossierResponse = {
  configured: true,
  address: { id: "addr-1", city: "Austin", state: "TX" },
  flood: { status: "ok", zone: "X", isHighRisk: false },
  school: { status: "error", districtName: null, ncesId: null },
  weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
};

async function render(ui: React.ReactNode): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(ui);
  });
  return { root, host };
}

async function waitFor(check: () => void): Promise<void> {
  const deadline = Date.now() + 1000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      check();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe("HomeDossier browser fetch cache", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    window.sessionStorage.clear();
  });

  it("uses a fresh sessionStorage dossier payload without calling the API again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.setItem(
      "lf:home-dossier:v1:addr-1",
      JSON.stringify({ expiresAt: Date.now() + 60_000, data: payload }),
    );

    const { root } = await render(<HomeDossier addressId="addr-1" />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Zone X");
    await act(async () => root.unmount());
  });

  it("stores successful fetches using the route max-age", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Cache-Control": "private, max-age=120" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { root } = await render(<HomeDossier addressId="addr-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const raw = window.sessionStorage.getItem("lf:home-dossier:v1:addr-1");
      expect(raw).toBeTruthy();
      const cached = JSON.parse(raw || "{}") as { expiresAt?: number; data?: HomeDossierResponse };
      expect(cached.data?.address?.id).toBe("addr-1");
      expect((cached.expiresAt ?? 0) - Date.now()).toBeGreaterThan(110_000);
    });
    await act(async () => root.unmount());
  });
});
