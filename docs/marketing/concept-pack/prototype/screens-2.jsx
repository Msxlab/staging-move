// prototype/screens-2.jsx — Home, Move, Checklist screens

// ── SCREEN 3: HOME / Dashboard ──────────────────────────────────────────
function HomeScreen({ lang, onPlanMove, onNavigate }) {
  const services = [
    { name: "PG&E", cat: "cat_utilities", amount: 142, status: "attention", icon: "zap", tone: C.amberFg, bg: "rgba(245,158,11,0.10)" },
    { name: "Comcast", cat: "cat_internet", amount: 89, status: "attention", icon: "zap", tone: C.roseFg, bg: "rgba(244,63,94,0.10)" },
    { name: "Netflix", cat: "cat_streaming", amount: 19.99, status: "active", icon: "zap", tone: C.skyFg, bg: "rgba(14,165,233,0.10)" },
    { name: "Geico", cat: "cat_insurance", amount: 187, status: "active", icon: "zap", tone: C.emeraldFg, bg: "rgba(16,185,129,0.10)" },
    { name: "ClassPass", cat: "cat_fitness", amount: 199, status: "attention", icon: "zap", tone: C.amberFg, bg: "rgba(245,158,11,0.10)" },
  ];
  const total = services.reduce((s, x) => s + x.amount, 0);
  const attention = [
    { titleKey: "home_attention_1", subKey: "home_attention_1_sub", tone: C.amberFg, br: "rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.06)" },
    { titleKey: "home_attention_2", subKey: "home_attention_2_sub", tone: C.roseFg, br: "rgba(244,63,94,0.25)", bg: "rgba(244,63,94,0.06)" },
    { titleKey: "home_attention_3", subKey: "home_attention_3_sub", tone: C.skyFg, br: "rgba(14,165,233,0.25)", bg: "rgba(14,165,233,0.06)" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, paddingBottom: 80, overflowY: "auto" }}>
      <Blobs/>
      <div style={{ padding: "60px 24px 0" }}>
        <div style={{ fontSize: 12, color: C.fg3, fontWeight: 500 }}>{T(lang, "home_greeting")}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontSize: 13, color: C.fg2, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="pin" size={14} color={C.orangeLight}/>
            <span>{T(lang, "home_address")}</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.fg2, fontSize: 13, fontWeight: 600 }}>JS</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 11, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{T(lang, "home_total_label")}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4, color: C.fg, fontVariantNumeric: "tabular-nums" }}>${total.toFixed(0)}<span style={{ fontSize: 13, fontWeight: 500, color: C.fg3 }}>/mo</span></div>
            <div style={{ fontSize: 11, color: C.fg3, marginTop: 2 }}>{T(lang, "home_total_sub", { n: services.length })}</div>
          </div>
          <div style={{ background: `linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,191,36,0.06))`, border: `1px solid rgba(249,115,22,0.25)`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 11, color: C.orangeLight, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{T(lang, "home_savings_label")}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4, color: C.fg, fontVariantNumeric: "tabular-nums" }}>$847</div>
            <div style={{ fontSize: 11, color: C.fg3, marginTop: 2 }}>{T(lang, "home_savings_sub")}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{T(lang, "home_quick_action")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { icon: "plus", label: "home_qa_add" },
              { icon: "truck", label: "home_qa_move", action: onPlanMove, primary: true },
              { icon: "refresh", label: "home_qa_sub" },
            ].map(qa => (
              <button key={qa.label} onClick={qa.action} style={{
                background: qa.primary ? `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})` : C.surface2,
                border: qa.primary ? "none" : `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "14px 8px",
                color: qa.primary ? "#fff" : C.fg2,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                boxShadow: qa.primary ? `0 8px 20px ${C.orange}30` : "none",
              }}>
                <Icon name={qa.icon} size={18} color={qa.primary ? "#fff" : C.orangeLight}/>
                <span>{T(lang, qa.label)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attention */}
        <div style={{ marginTop: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{T(lang, "home_recent_title")}</h3>
            <span style={{ fontSize: 11, color: C.orange, fontWeight: 600, letterSpacing: "0.05em" }}>{attention.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attention.map((a, i) => (
              <div key={i} style={{ background: a.bg, border: `1px solid ${a.br}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.tone, marginTop: 7, boxShadow: `0 0 8px ${a.tone}`, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{T(lang, a.titleKey)}</div>
                  <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, lineHeight: 1.4 }}>{T(lang, a.subKey)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Services list */}
        <div style={{ marginTop: 26 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, marginBottom: 10 }}>{T(lang, "home_section_services")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {services.map(s => (
              <div key={s.name} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.tone, flexShrink: 0 }}>
                  <Icon name={s.icon} size={16}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.fg3, marginTop: 1 }}>{T(lang, s.cat)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.fg2, fontVariantNumeric: "tabular-nums" }}>${s.amount.toFixed(s.amount % 1 === 0 ? 0 : 2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 4: MOVE PLANNER ──────────────────────────────────────────────
function MoveScreen({ lang, onBack, onContinue }) {
  const [to, setTo] = React.useState("");
  const [date, setDate] = React.useState("2026-06-15");
  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 28px 100px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Blobs/>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.fg2, fontSize: 14, cursor: "pointer", marginBottom: 18, padding: 0, alignSelf: "flex-start", fontFamily: "inherit" }}>← Back</button>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0, marginBottom: 8 }}>{T(lang, "move_title")}</h1>
      <p style={{ fontSize: 14, color: C.fg2, lineHeight: 1.5, margin: 0, marginBottom: 28 }}>{T(lang, "move_sub")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {/* From */}
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{T(lang, "move_from")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="pin" size={14} color={C.orangeLight}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>432 Oak St, Austin, TX</div>
          </div>
        </div>
        {/* To */}
        <div style={{ background: C.surface2, border: `1px solid ${to ? C.orange : C.border}`, borderRadius: 14, padding: 14, transition: "border-color 200ms" }}>
          <div style={{ fontSize: 11, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{T(lang, "move_to")}</div>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder={T(lang, "move_to_placeholder")}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: C.fg,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              outline: "none",
              padding: 0,
              boxSizing: "border-box",
            }}
          />
        </div>
        {/* Date */}
        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{T(lang, "move_date")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="cal" size={14} color={C.orangeLight}/>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ background: "transparent", border: "none", color: C.fg, fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", colorScheme: "dark" }}/>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 14, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.orangeLight, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
        <div style={{ fontSize: 13, color: C.fg2, lineHeight: 1.5 }}>
          We'll generate <span style={{ color: C.fg, fontWeight: 600 }}>11 tasks</span> across <span style={{ color: C.fg, fontWeight: 600 }}>5 categories</span> — utilities, internet, insurance, subscriptions, and mail forwarding.
        </div>
      </div>

      <button
        disabled={!to}
        onClick={() => onContinue({ to, date })}
        style={{
          background: to ? `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})` : C.surface2,
          color: to ? "#fff" : C.fg3,
          border: "none",
          padding: "16px 20px",
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: to ? "pointer" : "not-allowed",
          boxShadow: to ? `0 12px 30px ${C.orange}30` : "none",
          marginTop: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "200ms ease",
        }}
      >
        {T(lang, "move_continue")} <Icon name="arrow" size={16}/>
      </button>
    </div>
  );
}

// ── SCREEN 5: CHECKLIST (the climax) ────────────────────────────────────
function ChecklistScreen({ lang, moveData, onBack }) {
  const initial = [
    { id: 1, name: "PG&E",       cat: "cat_utilities", action: "transfer", icon: "zap" },
    { id: 2, name: "Comcast",    cat: "cat_internet",  action: "cancel",   icon: "zap" },
    { id: 3, name: "AT&T Fiber", cat: "cat_internet",  action: "reconnect",icon: "zap" },
    { id: 4, name: "Geico",      cat: "cat_insurance", action: "update",   icon: "zap" },
    { id: 5, name: "Allstate Renters", cat: "cat_insurance", action: "update", icon: "zap" },
    { id: 6, name: "Netflix",    cat: "cat_streaming", action: "update",   icon: "zap" },
    { id: 7, name: "Spotify",    cat: "cat_streaming", action: "update",   icon: "zap" },
    { id: 8, name: "ClassPass",  cat: "cat_fitness",   action: "cancel",   icon: "zap" },
    { id: 9, name: "USPS Forwarding", cat: "cat_utilities", action: "transfer", icon: "zap" },
    { id: 10, name: "City Water",cat: "cat_utilities", action: "transfer", icon: "zap" },
    { id: 11, name: "Trash & Recycling", cat: "cat_utilities", action: "transfer", icon: "zap" },
  ];
  const [items, setItems] = React.useState(initial.map(x => ({ ...x, done: false })));
  const [filter, setFilter] = React.useState("all");

  const toggle = (id) => setItems(prev => prev.map(x => x.id === id ? { ...x, done: !x.done } : x));

  const done = items.filter(x => x.done).length;
  const total = items.length;
  const pct = (done / total) * 100;
  const allDone = done === total;

  const filtered = items.filter(x => filter === "all" || (filter === "pending" && !x.done) || (filter === "done" && x.done));

  const actionColors = {
    transfer: { bg: "rgba(249,115,22,0.10)", fg: C.orangeLight, br: "rgba(249,115,22,0.22)" },
    cancel: { bg: "rgba(244,63,94,0.10)", fg: C.roseFg, br: "rgba(244,63,94,0.22)" },
    reconnect: { bg: "rgba(16,185,129,0.10)", fg: C.emeraldFg, br: "rgba(16,185,129,0.22)" },
    update: { bg: "rgba(14,165,233,0.10)", fg: C.skyFg, br: "rgba(14,165,233,0.22)" },
  };

  return (
    <div style={{ position: "absolute", inset: 0, paddingBottom: 80, overflowY: "auto" }}>
      <Blobs/>
      <div style={{ padding: "60px 24px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.fg2, fontSize: 14, cursor: "pointer", marginBottom: 16, padding: 0, fontFamily: "inherit" }}>← Back</button>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.orangeLight, letterSpacing: "0.2em", marginBottom: 8 }}>
          {T(lang, "chk_kicker")}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>{T(lang, "chk_title")}</h1>
        <p style={{ fontSize: 14, color: C.fg2, margin: "6px 0 18px" }}>{T(lang, "chk_sub", { done, total })}</p>

        {/* Progress bar */}
        <div style={{ height: 6, background: C.surface2, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, ${C.amber})`, borderRadius: 999, transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)" }}/>
        </div>

        {/* Completion celebration */}
        {allDone && (
          <div style={{ marginTop: 18, background: `linear-gradient(135deg, rgba(16,185,129,0.12), rgba(249,115,22,0.06))`, border: `1px solid rgba(16,185,129,0.3)`, borderRadius: 16, padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.fg }}>{T(lang, "chk_complete_title")}</div>
            <div style={{ fontSize: 13, color: C.fg2, marginTop: 4 }}>{T(lang, "chk_complete_sub")}</div>
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 18, marginBottom: 12 }}>
          {[
            { k: "all", l: "chk_filter_all", c: items.length },
            { k: "pending", l: "chk_filter_pending", c: items.filter(x => !x.done).length },
            { k: "done", l: "chk_filter_done", c: done },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              background: filter === f.k ? C.orange : "transparent",
              border: `1px solid ${filter === f.k ? C.orange : C.border}`,
              color: filter === f.k ? "#fff" : C.fg2,
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}>
              {T(lang, f.l)} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.c}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(item => {
            const ac = actionColors[item.action];
            return (
              <button key={item.id} onClick={() => toggle(item.id)} style={{
                background: item.done ? "rgba(16,185,129,0.04)" : C.surface2,
                border: `1px solid ${item.done ? "rgba(16,185,129,0.22)" : C.border}`,
                borderRadius: 14,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                transition: "200ms ease",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: item.done ? C.emerald : "transparent",
                  border: item.done ? "none" : `1.5px solid ${C.borderStrong}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "200ms ease",
                }}>
                  {item.done && <Icon name="check" size={14} color="#fff" strokeWidth={3}/>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: item.done ? C.fg3 : C.fg, textDecoration: item.done ? "line-through" : "none" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: C.fg3, marginTop: 2 }}>{T(lang, item.cat)}</div>
                </div>
                <div style={{
                  background: ac.bg, color: ac.fg, border: `1px solid ${ac.br}`,
                  borderRadius: 999, padding: "3px 10px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                  opacity: item.done ? 0.5 : 1,
                }}>
                  {T(lang, "chk_action_" + item.action)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab bar ─────────────────────────────────────────────────────────────
function TabBar({ lang, current, onChange }) {
  const tabs = [
    { id: "home", icon: "home", label: "tab_home" },
    { id: "services", icon: "zap", label: "tab_services" },
    { id: "move", icon: "truck", label: "tab_move" },
    { id: "more", icon: "more", label: "tab_more" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: "rgba(10,10,15,0.85)",
      backdropFilter: "blur(20px)",
      borderTop: `1px solid ${C.border}`,
      padding: "8px 12px 22px",
      display: "flex",
      justifyContent: "space-around",
      zIndex: 5,
    }}>
      {tabs.map(t => {
        const active = current === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "8px 12px",
            color: active ? C.orange : C.fg3,
            fontFamily: "inherit",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            transition: "color 200ms ease",
          }}>
            <Icon name={t.icon} size={20} strokeWidth={active ? 2.5 : 2}/>
            <span>{T(lang, t.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { HomeScreen, MoveScreen, ChecklistScreen, TabBar });
