import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Move - Address and moving management";
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
              background: "linear-gradient(135deg, #DCBC7C 0%, #B0852F 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(203, 164, 94, 0.40)",
            }}
          >
            <span style={{ fontSize: 40, fontWeight: 800, color: "#EFF3FA" }}>M</span>
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 0,
              color: "#EFF3FA",
            }}
          >
            Move
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
