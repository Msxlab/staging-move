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
            "linear-gradient(135deg, #0A0F18 0%, #0E1521 50%, #131C2C 100%)",
          color: "#ECF1F8",
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
              background: "linear-gradient(135deg, #B49BFF 0%, #5C9DDC 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(127, 182, 232, 0.40)",
            }}
          >
            <span style={{ fontSize: 40, fontWeight: 800, color: "#ECF1F8" }}>L</span>
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1.5,
              color: "#ECF1F8",
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
            letterSpacing: -2.5,
            marginBottom: 24,
            color: "#ECF1F8",
            maxWidth: 1000,
          }}
        >
          Address & Moving Management
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(236, 241, 248, 0.62)",
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
            background: "rgba(127, 182, 232, 0.10)",
            border: "1px solid rgba(127, 182, 232, 0.30)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#7FB6E8",
            }}
          />
          <span style={{ fontSize: 20, color: "#A5C9F0", fontWeight: 600 }}>
            locateflow.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
