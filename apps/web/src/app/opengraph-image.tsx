import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LocateFlow — Address & Moving Management";
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
            "linear-gradient(135deg, #0a0a0a 0%, #1a0f0a 50%, #2a1510 100%)",
          color: "#ffffff",
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
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(249, 115, 22, 0.4)",
            }}
          >
            <span style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>L</span>
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1.5,
              color: "#ffffff",
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
            color: "#ffffff",
            maxWidth: 1000,
          }}
        >
          Address & Moving Management
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255, 255, 255, 0.6)",
            lineHeight: 1.3,
            maxWidth: 900,
          }}
        >
          Manage addresses, services, and relocations — all in one place.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 48,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(249, 115, 22, 0.1)",
            border: "1px solid rgba(249, 115, 22, 0.3)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f97316",
            }}
          />
          <span style={{ fontSize: 20, color: "#fb923c", fontWeight: 600 }}>
            locateflow.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
