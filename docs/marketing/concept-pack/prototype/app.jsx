// prototype/app.jsx
// Interactive LocateFlow mobile prototype — 5 screens with realistic state.

const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surface2: "#1a1a25",
  surface3: "#22222f",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  fg: "#ffffff",
  fg2: "rgba(255,255,255,0.7)",
  fg3: "rgba(255,255,255,0.45)",
  orange: "#f97316",
  orangeLight: "#fb923c",
  amber: "#fbbf24",
  emerald: "#10b981",
  emeraldFg: "#6ee7b7",
  rose: "#ef4444",
  roseFg: "#fda4af",
  amberFg: "#fcd34d",
  skyFg: "#7dd3fc",
};

const T = (lang, k, vars) => {
  let s = (window.LF_T[lang] && window.LF_T[lang][k]) || k;
  if (vars) Object.keys(vars).forEach(v => { s = s.replace(`{${v}}`, vars[v]); });
  return s;
};

// ── Lucide-ish icons inline (just SVG paths) ─────────────────────────────
const Ic = {
  home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4v-7H10v7H6a2 2 0 01-2-2z"/>,
  pin: <path d="M12 21s-7-7.5-7-12a7 7 0 1114 0c0 4.5-7 12-7 12zm0-9a3 3 0 100-6 3 3 0 000 6z"/>,
  zap: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>,
  truck: <g><rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7zM5 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z"/></g>,
  more: <g><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></g>,
  bell: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>,
  check: <polyline points="20 6 9 17 4 12"/>,
  arrow: <path d="M5 12h14M13 5l7 7-7 7"/>,
  plus: <g><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>,
  alert: <g><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5"/></g>,
  search: <g><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></g>,
  cal: <g><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>,
  dollar: <g><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></g>,
  refresh: <g><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></g>,
};

const Icon = ({ name, size = 20, color = "currentColor", strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Ic[name]}
  </svg>
);

const LogoMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="lfm-p" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#D4A373"/>
        <stop offset="60%" stopColor="#E8794A"/>
        <stop offset="100%" stopColor="#C25A30"/>
      </linearGradient>
    </defs>
    <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="url(#lfm-p)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <circle cx="20" cy="65" r="4.5" fill="#D4A373"/>
    <circle cx="20" cy="65" r="1.5" fill={C.bg}/>
    <circle cx="80" cy="40" r="7" fill="#E8794A"/>
    <circle cx="80" cy="40" r="2.5" fill="#FAF7F1"/>
  </svg>
);

// ── Phone shell ──────────────────────────────────────────────────────────
function Phone({ children }) {
  return (
    <div style={{
      width: 380, height: 800,
      background: "#000",
      borderRadius: 48,
      padding: 8,
      boxShadow: "0 0 0 1.5px rgba(255,255,255,0.08), 0 50px 100px rgba(0,0,0,0.6), 0 0 100px rgba(249,115,22,0.08)",
      position: "relative",
    }}>
      <div style={{
        width: "100%", height: "100%",
        background: C.bg,
        borderRadius: 40,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Notch */}
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 110, height: 28, background: "#000", borderRadius: 16, zIndex: 10 }}/>
        {/* Status bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 28px 0", fontSize: 13, fontWeight: 600, color: C.fg, fontVariantNumeric: "tabular-nums",
        }}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="2" height="4" rx="0.5"/><rect x="3" y="4" width="2" height="6" rx="0.5"/><rect x="6" y="2" width="2" height="8" rx="0.5"/><rect x="9" y="0" width="2" height="10" rx="0.5"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 1.5C9.4 1.5 11.6 2.4 13.3 4l-1.4 1.4A6 6 0 007 3.5a6 6 0 00-4.9 1.9L0.7 4A8 8 0 017 1.5zm0 3a5 5 0 013.5 1.5l-1.4 1.4A3 3 0 007 6.5a3 3 0 00-2.1.9L3.5 6A5 5 0 017 4.5zm0 3a2 2 0 011.4.6L7 9.5 5.6 8.1A2 2 0 017 7.5z"/></svg>
            <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="currentColor"/><rect x="2" y="2" width="14" height="6" rx="1" fill="currentColor"/><rect x="19.5" y="3" width="1.5" height="4" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {children}
        </div>
        {/* Home indicator */}
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 134, height: 4, background: "rgba(255,255,255,0.4)", borderRadius: 2 }}/>
      </div>
    </div>
  );
}

// ── Decorative blob bg ───────────────────────────────────────────────────
const Blobs = () => (
  <>
    <div style={{ position: "absolute", top: -80, right: -60, width: 240, height: 240, borderRadius: "50%", background: C.orange, filter: "blur(60px)", opacity: 0.15, pointerEvents: "none" }}/>
    <div style={{ position: "absolute", bottom: -80, left: -60, width: 240, height: 240, borderRadius: "50%", background: C.amber, filter: "blur(70px)", opacity: 0.08, pointerEvents: "none" }}/>
  </>
);

// ── SCREEN 1: Onboarding (chaos / recognition) ───────────────────────────
function OnboardingScreen({ lang, onContinue }) {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 28px 110px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Blobs/>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
        <LogoMark size={28}/>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>LocateFlow</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.orangeLight, letterSpacing: "0.2em", marginBottom: 14 }}>
        {T(lang, "onb_kicker")}
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05, margin: 0, marginBottom: 14, color: C.fg }}>
        {T(lang, "onb_title")}
      </h1>
      <p style={{ fontSize: 15, color: C.fg2, lineHeight: 1.55, margin: 0, marginBottom: 32 }}>
        {T(lang, "onb_sub")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {[
          { k: "onb_step1", icon: "alert", tone: C.roseFg, bg: "rgba(244,63,94,0.08)", br: "rgba(244,63,94,0.18)" },
          { k: "onb_step2", icon: "zap", tone: C.amberFg, bg: "rgba(245,158,11,0.08)", br: "rgba(245,158,11,0.18)" },
          { k: "onb_step3", icon: "bell", tone: C.skyFg, bg: "rgba(14,165,233,0.08)", br: "rgba(14,165,233,0.18)" },
        ].map(s => (
          <div key={s.k} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, border: `1px solid ${s.br}`, display: "flex", alignItems: "center", justifyContent: "center", color: s.tone, flexShrink: 0 }}>
              <Icon name={s.icon} size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>{T(lang, s.k)}</div>
              <div style={{ fontSize: 12, color: C.fg3, marginTop: 4, lineHeight: 1.4 }}>{T(lang, s.k + "_sub")}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onContinue} style={{
        background: `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`,
        color: "#fff",
        border: "none",
        padding: "16px 20px",
        borderRadius: 14,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        boxShadow: `0 12px 30px ${C.orange}30`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginTop: "auto",
      }}>
        {T(lang, "onb_cta")} <Icon name="arrow" size={16}/>
      </button>
    </div>
  );
}

// ── SCREEN 2: Address ────────────────────────────────────────────────────
function AddressScreen({ lang, onBack, onContinue }) {
  const [val, setVal] = React.useState("");
  const suggestions = [
    "432 Oak St, Austin, TX 78704",
    "1290 Maple Ave, Austin, TX 78704",
    "78 Riverside Dr #4B, Austin, TX 78741",
  ];
  const filtered = val.length === 0 ? suggestions : suggestions.filter(s => s.toLowerCase().includes(val.toLowerCase()));

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 28px 110px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Blobs/>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.fg2, fontSize: 14, cursor: "pointer", marginBottom: 24, padding: 0, alignSelf: "flex-start", fontFamily: "inherit" }}>← Back</button>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0, marginBottom: 10 }}>{T(lang, "addr_title")}</h1>
      <p style={{ fontSize: 14, color: C.fg2, lineHeight: 1.5, margin: 0, marginBottom: 28 }}>{T(lang, "addr_sub")}</p>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: C.fg3, pointerEvents: "none" }}>
          <Icon name="search" size={18}/>
        </div>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={T(lang, "addr_placeholder")}
          style={{
            width: "100%",
            padding: "16px 16px 16px 44px",
            background: C.surface2,
            border: `1px solid ${val ? C.orange : C.border}`,
            borderRadius: 14,
            color: C.fg,
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 200ms ease",
          }}
        />
      </div>

      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.fg3, letterSpacing: "0.15em", marginTop: 16, marginBottom: 8 }}>
        {T(lang, "addr_recent").toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map((s, i) => (
          <button key={i} onClick={() => setVal(s)} style={{
            background: s === val ? "rgba(249,115,22,0.08)" : "transparent",
            border: `1px solid ${s === val ? "rgba(249,115,22,0.3)" : "transparent"}`,
            borderRadius: 12,
            padding: "12px 14px",
            color: C.fg2,
            fontSize: 13,
            textAlign: "left",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
            fontFamily: "inherit",
            transition: "200ms ease",
          }}>
            <Icon name="pin" size={16} color={C.orangeLight}/>
            <span>{s}</span>
          </button>
        ))}
      </div>

      <button
        disabled={!val}
        onClick={() => onContinue(val)}
        style={{
          background: val ? `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})` : C.surface2,
          color: val ? "#fff" : C.fg3,
          border: "none",
          padding: "16px 20px",
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: val ? "pointer" : "not-allowed",
          boxShadow: val ? `0 12px 30px ${C.orange}30` : "none",
          marginTop: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "200ms ease",
        }}
      >
        {T(lang, "addr_continue")} <Icon name="arrow" size={16}/>
      </button>
    </div>
  );
}

Object.assign(window, { C, T, Icon, LogoMark, Phone, Blobs, OnboardingScreen, AddressScreen });
