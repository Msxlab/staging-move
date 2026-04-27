// video/scenes.jsx — LocateFlow 90-second story
// Scenes: Chaos → Recognition → Reveal → Relief → Trust
// All scenes pull copy from window.LF_COPY[lang][tone][key]

const ORANGE = "#f97316";
const ORANGE_LIGHT = "#fb923c";
const AMBER = "#fbbf24";
const BG_DARK = "#0a0a0f";
const BG_MID = "#12121a";
const SURFACE = "#1a1a25";
const FG = "#ffffff";
const FG_DIM = "rgba(255,255,255,0.6)";
const FG_FAINT = "rgba(255,255,255,0.35)";

// ── Helper: get copy ─────────────────────────────────────────────────────
const useCopy = () => {
  const lang = window.__LF_LANG || "en";
  const tone = window.__LF_TONE || "dramatic";
  return window.LF_COPY[lang][tone];
};

// ── Background blob (signature LocateFlow glow) ──────────────────────────
function Blob({ x, y, size = 400, color = ORANGE, opacity = 0.18 }) {
  return (
    <div style={{
      position: "absolute",
      left: x, top: y,
      width: size, height: size,
      borderRadius: "50%",
      background: color,
      filter: "blur(80px)",
      opacity,
      pointerEvents: "none",
    }} />
  );
}

// ── Logo mark ────────────────────────────────────────────────────────────
function LogoMark({ size = 60, opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity, display: "block" }}>
      <defs>
        <linearGradient id="lfm-flow-v" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#D4A373" />
          <stop offset="60%" stopColor="#E8794A" />
          <stop offset="100%" stopColor="#C25A30" />
        </linearGradient>
      </defs>
      <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="url(#lfm-flow-v)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="65" r="4.5" fill="#D4A373" />
      <circle cx="20" cy="65" r="1.5" fill={BG_DARK} />
      <circle cx="80" cy="40" r="7" fill="#E8794A" />
      <circle cx="80" cy="40" r="2.5" fill="#FAF7F1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE 1: CHAOS (0–18s)
// Phone mockup tilted, notifications cascading, then everything shakes
// ─────────────────────────────────────────────────────────────────────────
function Scene1Chaos() {
  const time = useTime();
  const c = useCopy();

  // Phone tilt + drift
  const phoneRot = interpolate([0, 6, 14, 18], [-2, -3, 4, 6], Easing.easeInOutCubic)(time);
  const phoneScale = interpolate([0, 6, 18], [1.0, 1.05, 0.92], Easing.easeInOutCubic)(time);
  const phoneShake = time > 12 ? Math.sin(time * 30) * (time - 12) * 0.8 : 0;

  // Vignette darkens as panic builds
  const vignette = interpolate([0, 18], [0.4, 0.7], Easing.easeInQuad)(time);

  const notifications = [
    { t: 2.5, label: "PG&E", desc: "Past due · $142.18", tone: "danger" },
    { t: 4.0, label: "Comcast", desc: "Final notice", tone: "danger" },
    { t: 5.5, label: "ClassPass", desc: "Renewed at old card", tone: "warning" },
    { t: 7.0, label: "Verizon", desc: "Service still active", tone: "warning" },
    { t: 8.5, label: "Netflix", desc: "Charged $19.99", tone: "warning" },
    { t: 10.0, label: "Anytime Fitness", desc: "Auto-renewed", tone: "danger" },
    { t: 11.5, label: "USPS", desc: "Mail forwarding ends in 3 days", tone: "warning" },
    { t: 13.0, label: "AT&T", desc: "Disconnect failed", tone: "danger" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: BG_DARK, overflow: "hidden" }}>
      {/* Subtle red/orange tension blob */}
      <Blob x={-200} y={-200} size={700} color="#dc2626" opacity={0.12} />
      <Blob x={1200} y={500} size={600} color={ORANGE} opacity={0.1} />

      {/* Kicker + headline */}
      <Sprite start={0.5} end={6.5}>
        <div style={{ position: "absolute", left: 80, top: 80 }}>
          <TextSprite text={c.s1_kicker} x={0} y={0} size={14} color={ORANGE} weight={600} letterSpacing="0.2em" entryDur={0.4} exitDur={0.4} />
        </div>
      </Sprite>
      <Sprite start={1.0} end={6.5}>
        <TextSprite text={c.s1_line1} x={80} y={120} size={64} color={FG} weight={700} entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={2.5} end={6.5}>
        <TextSprite text={c.s1_line2} x={80} y={200} size={64} color={FG_DIM} weight={500} entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={4.0} end={6.5}>
        <TextSprite text={c.s1_line3} x={80} y={280} size={64} color={FG_FAINT} weight={500} entryDur={0.5} exitDur={0.4} />
      </Sprite>

      {/* Phone mockup, center-right, tilting + shaking */}
      <div style={{
        position: "absolute",
        right: 100, top: 90,
        width: 360, height: 720,
        transform: `rotate(${phoneRot + phoneShake}deg) scale(${phoneScale})`,
        transformOrigin: "center",
      }}>
        <div style={{
          width: "100%", height: "100%",
          background: "#000",
          borderRadius: 48,
          padding: 8,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}>
          <div style={{
            width: "100%", height: "100%",
            background: BG_MID,
            borderRadius: 40,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "60px 18px 18px",
            gap: 10,
          }}>
            <div style={{ fontSize: 11, color: FG_FAINT, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", marginBottom: 8 }}>
              NOTIFICATIONS · 8 NEW
            </div>
            {notifications.map((n, i) => (
              <Sprite key={i} start={n.t} end={20}>
                {({ localTime }) => {
                  const ent = Math.min(1, localTime / 0.4);
                  const eased = Easing.easeOutBack(ent);
                  const color = n.tone === "danger" ? "#ef4444" : "#f59e0b";
                  return (
                    <div style={{
                      background: SURFACE,
                      border: `1px solid ${color}33`,
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: ent,
                      transform: `translateY(${(1 - eased) * 20}px) scale(${0.95 + eased * 0.05})`,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{n.label}</div>
                        <div style={{ fontSize: 11, color: FG_DIM, marginTop: 2 }}>{n.desc}</div>
                      </div>
                    </div>
                  );
                }}
              </Sprite>
            ))}
          </div>
        </div>
      </div>

      {/* Final shake → fade to next scene */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignette}) 100%)`,
        pointerEvents: "none",
      }} />

      {/* Hard fade out at end */}
      {time > 16 && (
        <div style={{
          position: "absolute", inset: 0,
          background: BG_DARK,
          opacity: clamp((time - 16) / 2, 0, 1),
        }} />
      )}
    </div>
  );
}

// Helper inline (since clamp isn't exported)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────────────────────────────────
// SCENE 2: RECOGNITION (18–35s)
// Floating chips of provider names — "this is what you forgot"
// ─────────────────────────────────────────────────────────────────────────
function Scene2Recognition() {
  const t = useTime();
  const local = t - 18;
  const c = useCopy();

  const chips = [
    { label: "PG&E",       tone: "rose",    x: 180, y: 200 },
    { label: "Verizon",    tone: "amber",   x: 480, y: 140 },
    { label: "Netflix",    tone: "rose",    x: 820, y: 220 },
    { label: "ClassPass",  tone: "amber",   x: 1180, y: 160 },
    { label: "USPS",       tone: "sky",     x: 1500, y: 240 },
    { label: "Spotify",    tone: "amber",   x: 240, y: 540 },
    { label: "Comcast",    tone: "rose",    x: 580, y: 620 },
    { label: "Anytime Fitness", tone: "rose", x: 920, y: 580 },
    { label: "AT&T",       tone: "amber",   x: 1280, y: 640 },
    { label: "HOA Dues",   tone: "sky",     x: 1580, y: 560 },
    { label: "Geico",      tone: "amber",   x: 380, y: 380 },
    { label: "Hulu",       tone: "rose",    x: 1080, y: 400 },
    { label: "Allstate",   tone: "sky",     x: 1420, y: 420 },
  ];

  const toneColors = {
    rose: { bg: "rgba(244,63,94,0.10)", br: "rgba(244,63,94,0.25)", fg: "#fda4af" },
    amber: { bg: "rgba(245,158,11,0.10)", br: "rgba(245,158,11,0.25)", fg: "#fcd34d" },
    sky: { bg: "rgba(14,165,233,0.10)", br: "rgba(14,165,233,0.25)", fg: "#7dd3fc" },
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: BG_DARK, overflow: "hidden" }}>
      <Blob x={-100} y={300} size={500} color={ORANGE} opacity={0.08} />
      <Blob x={1300} y={-100} size={500} color="#fbbf24" opacity={0.06} />

      {/* Headline center */}
      <Sprite start={18.5} end={34}>
        <div style={{ position: "absolute", left: "50%", top: 380, transform: "translate(-50%, 0)", textAlign: "center", width: "100%" }}>
          <TextSprite text={c.s2_kicker} x={960} y={0} size={14} color={ORANGE} weight={600} letterSpacing="0.2em" align="center" entryDur={0.4} exitDur={0.4} />
        </div>
      </Sprite>

      {/* Three lines stacking */}
      <Sprite start={19} end={34}>
        <TextSprite text={c.s2_line1} x={960} y={420} size={48} color={FG} weight={600} align="center" entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={21} end={34}>
        <TextSprite text={c.s2_line2} x={960} y={490} size={48} color={FG} weight={600} align="center" entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={23} end={34}>
        <TextSprite text={c.s2_line3} x={960} y={560} size={36} color={FG_DIM} weight={500} align="center" entryDur={0.5} exitDur={0.4} />
      </Sprite>

      {/* Chips floating in, drifting slowly */}
      {chips.map((chip, i) => {
        const startT = 18.2 + i * 0.18;
        return (
          <Sprite key={i} start={startT} end={34}>
            {({ localTime }) => {
              const ent = clamp(localTime / 0.5, 0, 1);
              const eased = Easing.easeOutBack(ent);
              // slow drift
              const drift = Math.sin((localTime + i) * 0.4) * 6;
              const colors = toneColors[chip.tone];
              return (
                <div style={{
                  position: "absolute",
                  left: chip.x, top: chip.y + drift,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: colors.bg,
                  border: `1px solid ${colors.br}`,
                  color: colors.fg,
                  fontSize: 14,
                  fontWeight: 500,
                  opacity: ent * 0.9,
                  transform: `scale(${0.7 + eased * 0.3})`,
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                }}>
                  {chip.label}
                </div>
              );
            }}
          </Sprite>
        );
      })}

      {/* Fade transition out */}
      {t > 33 && (
        <div style={{ position: "absolute", inset: 0, background: BG_DARK, opacity: clamp((t - 33) / 2, 0, 1) }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE 3: REVEAL (35–55s)
// Logo emerges from black. Headline: "One address. Every service. One place."
// ─────────────────────────────────────────────────────────────────────────
function Scene3Reveal() {
  const t = useTime();
  const local = t - 35;
  const c = useCopy();

  // Soft amber glow rises from below
  const glowOpacity = interpolate([0, 4, 18, 20], [0, 0.35, 0.4, 0.2], Easing.easeOutCubic)(local);
  const logoScale = interpolate([0, 2, 5], [0.3, 1.1, 1.0], Easing.easeOutBack)(local);
  const logoOpacity = clamp(local / 1.2, 0, 1);

  return (
    <div style={{ position: "absolute", inset: 0, background: BG_DARK, overflow: "hidden" }}>
      {/* Big warm glow rising */}
      <div style={{
        position: "absolute",
        left: "50%", top: "55%",
        width: 1400, height: 1400,
        marginLeft: -700, marginTop: -700,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${ORANGE} 0%, transparent 60%)`,
        filter: "blur(60px)",
        opacity: glowOpacity,
      }} />
      <div style={{
        position: "absolute",
        left: "50%", top: "60%",
        width: 800, height: 800,
        marginLeft: -400, marginTop: -400,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${AMBER} 0%, transparent 60%)`,
        filter: "blur(80px)",
        opacity: glowOpacity * 0.6,
      }} />

      {/* Logo mark center */}
      <div style={{
        position: "absolute",
        left: "50%", top: 240,
        transform: `translate(-50%, 0) scale(${logoScale})`,
        opacity: logoOpacity,
      }}>
        <LogoMark size={120} />
      </div>

      {/* Wordmark beneath */}
      <Sprite start={36.5} end={55}>
        <TextSprite text="LocateFlow" x={960} y={400} size={28} color={FG} weight={500} align="center" letterSpacing="0.02em" entryDur={0.6} exitDur={0.4} />
      </Sprite>

      {/* Kicker */}
      <Sprite start={37.5} end={54}>
        <TextSprite text={c.s3_kicker} x={960} y={460} size={12} color={ORANGE_LIGHT} weight={600} letterSpacing="0.2em" align="center" entryDur={0.5} exitDur={0.4} />
      </Sprite>

      {/* Three big lines, staggered */}
      <Sprite start={40} end={54}>
        <TextSprite text={c.s3_line1} x={960} y={540} size={72} color={FG} weight={700} align="center" entryDur={0.6} exitDur={0.4} />
      </Sprite>
      <Sprite start={43} end={54}>
        <TextSprite text={c.s3_line2} x={960} y={640} size={72} color={ORANGE} weight={700} align="center" entryDur={0.6} exitDur={0.4} />
      </Sprite>
      <Sprite start={46} end={54}>
        <TextSprite text={c.s3_line3} x={960} y={740} size={72} color={FG} weight={700} align="center" entryDur={0.6} exitDur={0.4} />
      </Sprite>

      {/* Fade transition */}
      {t > 53 && (
        <div style={{ position: "absolute", inset: 0, background: "#0c0c14", opacity: clamp((t - 53) / 2, 0, 1) }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE 4: RELIEF (55–75s)
// Phone mockup, calm now. Service rows organize, get checked off.
// ─────────────────────────────────────────────────────────────────────────
function Scene4Relief() {
  const t = useTime();
  const local = t - 55;
  const c = useCopy();

  const services = [
    { name: "PG&E", category: "Electricity", action: "Transferred", t: 2 },
    { name: "Comcast", category: "Internet", action: "Cancelled", t: 3.5 },
    { name: "Verizon", category: "Phone", action: "Transferred", t: 5 },
    { name: "Netflix", category: "Streaming", action: "Address updated", t: 6.5 },
    { name: "ClassPass", category: "Fitness", action: "Cancelled", t: 8 },
    { name: "Geico", category: "Auto Insurance", action: "Address updated", t: 9.5 },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0c0c14", overflow: "hidden" }}>
      <Blob x={1200} y={-100} size={500} color={ORANGE} opacity={0.12} />
      <Blob x={-100} y={500} size={500} color={AMBER} opacity={0.08} />

      {/* Left side: kicker + 3 lines */}
      <Sprite start={55.5} end={74}>
        <div style={{ position: "absolute", left: 100, top: 180 }}>
          <TextSprite text={c.s4_kicker} x={0} y={0} size={13} color={ORANGE} weight={600} letterSpacing="0.2em" entryDur={0.5} exitDur={0.4} />
        </div>
      </Sprite>
      <Sprite start={57} end={74}>
        <TextSprite text={c.s4_line1} x={100} y={250} size={72} color={FG} weight={700} entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={60} end={74}>
        <TextSprite text={c.s4_line2} x={100} y={350} size={72} color={FG} weight={700} entryDur={0.5} exitDur={0.4} />
      </Sprite>
      <Sprite start={63} end={74}>
        <TextSprite text={c.s4_line3} x={100} y={450} size={72} color={ORANGE} weight={700} entryDur={0.5} exitDur={0.4} />
      </Sprite>

      {/* Right side: phone with service list ticking off */}
      <div style={{
        position: "absolute",
        right: 120, top: 80,
        width: 360, height: 720,
      }}>
        <div style={{
          width: "100%", height: "100%",
          background: "#000",
          borderRadius: 48,
          padding: 8,
          boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 80px ${ORANGE}25`,
        }}>
          <div style={{
            width: "100%", height: "100%",
            background: BG_MID,
            borderRadius: 40,
            overflow: "hidden",
            position: "relative",
            padding: "50px 16px 16px",
          }}>
            {/* Header */}
            <div style={{ padding: "8px 8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: FG_FAINT, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em" }}>
                432 OAK ST · MOVING DAY
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FG, marginTop: 4, letterSpacing: "-0.02em" }}>
                Your services
              </div>
            </div>

            {/* Service rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {services.map((s, i) => (
                <Sprite key={i} start={55 + s.t} end={76}>
                  {({ localTime }) => {
                    const ent = clamp(localTime / 0.4, 0, 1);
                    const checkedAt = 0.8;
                    const checked = localTime > checkedAt;
                    const checkProgress = clamp((localTime - checkedAt) / 0.5, 0, 1);
                    return (
                      <div style={{
                        background: SURFACE,
                        border: `1px solid ${checked ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 14,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        opacity: ent,
                        transform: `translateX(${(1 - ent) * 20}px)`,
                        transition: "border-color 200ms ease",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: checked ? "#10b981" : "rgba(255,255,255,0.05)",
                          border: checked ? "none" : "1px solid rgba(255,255,255,0.12)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 300ms ease",
                        }}>
                          {checked && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 24, strokeDashoffset: 24 - checkProgress * 24 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: FG_DIM, marginTop: 2 }}>{s.category}</div>
                        </div>
                        {checked && (
                          <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 600, letterSpacing: "0.05em", opacity: checkProgress }}>
                            {s.action.toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  }}
                </Sprite>
              ))}
            </div>

            {/* Progress at top */}
            <div style={{ position: "absolute", top: 50, left: 24, right: 24, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <Sprite start={55} end={76}>
                {({ localTime }) => {
                  const completed = services.filter(s => localTime > s.t + 0.8).length;
                  const pct = (completed / services.length) * 100;
                  return (
                    <div style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${ORANGE}, ${AMBER})`,
                      transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }} />
                  );
                }}
              </Sprite>
            </div>
          </div>
        </div>
      </div>

      {/* Fade transition */}
      {t > 73 && (
        <div style={{ position: "absolute", inset: 0, background: "#fafaf7", opacity: clamp((t - 73) / 2, 0, 1) }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE 5: TRUST / CTA (75–90s) — LIGHT mode!
// The arc lands. Light, calm, with the final message and CTA.
// ─────────────────────────────────────────────────────────────────────────
function Scene5Trust() {
  const t = useTime();
  const local = t - 75;
  const c = useCopy();

  // Light surface
  const BG_LIGHT = "#fafaf7";
  const FG_LIGHT = "#0a0a0f";
  const FG_LIGHT_DIM = "rgba(10,10,15,0.65)";

  return (
    <div style={{ position: "absolute", inset: 0, background: BG_LIGHT, overflow: "hidden" }}>
      {/* Soft warm gradient */}
      <div style={{
        position: "absolute",
        left: "50%", top: "100%",
        width: 1600, height: 1600,
        marginLeft: -800, marginTop: -800,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${ORANGE}30 0%, transparent 60%)`,
        filter: "blur(60px)",
      }} />
      <div style={{
        position: "absolute",
        left: -200, top: -200,
        width: 600, height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${AMBER}25 0%, transparent 70%)`,
        filter: "blur(80px)",
      }} />

      {/* Logo top-left */}
      <Sprite start={75.5} end={90}>
        <div style={{ position: "absolute", left: 100, top: 100, display: "flex", alignItems: "center", gap: 14 }}>
          <LogoMark size={44} />
          <div style={{ fontSize: 22, fontWeight: 600, color: FG_LIGHT, letterSpacing: "-0.01em" }}>LocateFlow</div>
        </div>
      </Sprite>

      {/* Center stack */}
      <Sprite start={76} end={90}>
        <TextSprite text={c.s5_kicker} x={960} y={340} size={13} color={ORANGE} weight={600} letterSpacing="0.25em" align="center" entryDur={0.6} />
      </Sprite>

      <Sprite start={77} end={90}>
        <TextSprite text={c.s5_line1} x={960} y={400} size={84} color={FG_LIGHT} weight={700} align="center" entryDur={0.7} />
      </Sprite>
      <Sprite start={79} end={90}>
        <TextSprite text={c.s5_line2} x={960} y={510} size={84} color={ORANGE} weight={700} align="center" entryDur={0.7} />
      </Sprite>

      {/* CTA button */}
      <Sprite start={82} end={90}>
        {({ localTime }) => {
          const ent = clamp(localTime / 0.6, 0, 1);
          const eased = Easing.easeOutBack(ent);
          return (
            <div style={{
              position: "absolute",
              left: "50%", top: 660,
              transform: `translate(-50%, 0) scale(${0.8 + eased * 0.2})`,
              opacity: ent,
            }}>
              <div style={{
                background: ORANGE,
                color: "#fff",
                padding: "20px 40px",
                borderRadius: 14,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                boxShadow: `0 20px 60px ${ORANGE}40, 0 0 0 1px ${ORANGE}`,
                display: "inline-block",
              }}>
                {c.s5_cta} →
              </div>
            </div>
          );
        }}
      </Sprite>

      <Sprite start={84} end={90}>
        <TextSprite text="No credit card required · 14 day free trial" x={960} y={760} size={13} color={FG_LIGHT_DIM} weight={500} align="center" entryDur={0.5} />
      </Sprite>

      {/* Footer trust line */}
      <Sprite start={85} end={90}>
        <div style={{
          position: "absolute",
          left: "50%", bottom: 60,
          transform: "translateX(-50%)",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: "rgba(10,10,15,0.4)",
          letterSpacing: "0.15em",
          opacity: clamp((local - 10) / 0.6, 0, 1),
        }}>
          MADE WITH CARE FOR MOVERS EVERYWHERE
        </div>
      </Sprite>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN VIDEO COMPONENT
// ─────────────────────────────────────────────────────────────────────────
function LocateFlowVideo() {
  const t = useTime();

  // Update screen label for comments
  React.useEffect(() => {
    const sec = Math.floor(t);
    const root = document.querySelector("[data-video-root]");
    if (root) root.setAttribute("data-screen-label", `t=${sec}s`);
  }, [Math.floor(t)]);

  return (
    <div data-video-root style={{ position: "absolute", inset: 0, background: BG_DARK }}>
      <Sprite start={0} end={18.5}><Scene1Chaos /></Sprite>
      <Sprite start={18} end={35.5}><Scene2Recognition /></Sprite>
      <Sprite start={35} end={55.5}><Scene3Reveal /></Sprite>
      <Sprite start={55} end={75.5}><Scene4Relief /></Sprite>
      <Sprite start={75} end={90}><Scene5Trust /></Sprite>
    </div>
  );
}

Object.assign(window, { LocateFlowVideo });
