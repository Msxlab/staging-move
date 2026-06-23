import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LocateFlow - Address and moving management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "80px",
          background:
            "linear-gradient(135deg, #070B14 0%, #121B2D 50%, #18233A 100%)",
          color: "#EFF3FA",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(135deg, #18233A 0%, #0E1521 100%)",
              border: "1px solid rgba(203, 164, 94, 0.30)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(203, 164, 94, 0.30)",
            }}
          >
            {/*
             * Official LocateFlow brand mark — the parametric raccoon
             * (Raccoon.dc.html), `calm` mood, gold eye baked in (Satori can't
             * resolve `hsl(var(--primary))`, so the dark-mode accent #CBA45E is
             * inlined for the static card). Replaces the legacy "M" glyph.
             */}
            <svg width="54" height="54" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 40 L12 8 L34 24Z" fill="#8C9AB2" />
              <path d="M19 37 L15 14 L30 24Z" fill="#C4A090" />
              <path d="M82 40 L88 8 L66 24Z" fill="#8C9AB2" />
              <path d="M81 37 L85 14 L70 24Z" fill="#C4A090" />
              <ellipse cx="50" cy="58" rx="36" ry="31" fill="#8C9AB2" />
              <ellipse cx="33" cy="51" rx="16" ry="13" fill="#0C1525" />
              <ellipse cx="67" cy="51" rx="16" ry="13" fill="#0C1525" />
              <rect x="44" y="46" width="12" height="10" rx="5" fill="#0C1525" />
              <path d="M20 43 Q50 36 80 43" stroke="#0C1525" strokeWidth="8" strokeLinecap="round" fill="none" />
              <circle cx="33" cy="51" r="8" fill="#CBA45E" />
              <circle cx="33" cy="51" r="5" fill="#04080F" />
              <circle cx="67" cy="51" r="8" fill="#CBA45E" />
              <circle cx="67" cy="51" r="5" fill="#04080F" />
              <path d="M46 66 L50 72 L54 66 Q50 63 46 66Z" fill="#0C1525" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 0,
              color: "#EFF3FA",
            }}
          >
            LocateFlow
          </span>
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: 0,
            marginBottom: 24,
            color: "#EFF3FA",
            maxWidth: 1000,
          }}
        >
          Address & Moving Management
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(239, 243, 250, 0.62)",
            lineHeight: 1.3,
            maxWidth: 900,
          }}
        >
          Manage addresses, services, and relocations - all in one place.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 48,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(203, 164, 94, 0.10)",
            border: "1px solid rgba(203, 164, 94, 0.30)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#CBA45E",
            }}
          />
          <span style={{ fontSize: 20, color: "#DCBC7C", fontWeight: 600 }}>
            locateflow.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
