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
            "linear-gradient(135deg, #0E0A07 0%, #181410 50%, #261F17 100%)",
          color: "#F5F1EA",
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
              background: "linear-gradient(135deg, #EDB99D 0%, #A85A42 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(212, 132, 106, 0.40)",
            }}
          >
            <span style={{ fontSize: 40, fontWeight: 800, color: "#F5F1EA" }}>L</span>
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1.5,
              color: "#F5F1EA",
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
            color: "#F5F1EA",
            maxWidth: 1000,
          }}
        >
          Address & Moving Management
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(245, 241, 234, 0.62)",
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
            background: "rgba(212, 132, 106, 0.10)",
            border: "1px solid rgba(212, 132, 106, 0.30)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#D4846A",
            }}
          />
          <span style={{ fontSize: 20, color: "#EDB99D", fontWeight: 600 }}>
            locateflow.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
