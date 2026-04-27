// prototype/more-screen.jsx — More tab with 6 sub-pages
// Profile · Payment methods · Notifications · Documents · Premium · Help

const MORE_T = {
  en: {
    more_title: "More",
    more_subtitle: "Account, billing, and beyond.",
    section_account: "Account",
    section_app: "App",
    section_support: "Support",
    item_profile: "Profile",
    item_profile_sub: "Jamie · 432 Oak St",
    item_payment: "Payment methods",
    item_payment_sub: "2 cards · default ending 4242",
    item_notifications: "Notifications",
    item_notifications_sub: "12 reminders · weekly digest",
    item_documents: "Documents",
    item_documents_sub: "47 files · OCR'd & searchable",
    item_premium: "LocateFlow Premium",
    item_premium_sub: "Unlimited addresses · priority support",
    item_help: "Help & support",
    item_help_sub: "Guides, contact, status",
    item_signout: "Sign out",
    // Profile
    profile_title: "Profile",
    profile_name: "Full name",
    profile_email: "Email",
    profile_phone: "Phone",
    profile_address: "Primary address",
    profile_member: "Member since",
    profile_save: "Save changes",
    // Payment
    pay_title: "Payment methods",
    pay_default: "Default",
    pay_add: "Add a new card",
    pay_billing_history: "Billing history",
    pay_invoice: "Invoice",
    // Notifications
    notif_title: "Notifications",
    notif_section_reminders: "Reminders",
    notif_section_channels: "How you're notified",
    notif_renewals: "Renewal warnings",
    notif_renewals_sub: "3 days before any service renews",
    notif_pricehikes: "Price hikes",
    notif_pricehikes_sub: "Alert when a bill goes up",
    notif_unused: "Unused services",
    notif_unused_sub: "Flag subs you haven't used in 30 days",
    notif_movetasks: "Move-day tasks",
    notif_movetasks_sub: "Step-by-step on relocation day",
    notif_push: "Push",
    notif_email: "Email",
    notif_sms: "SMS",
    notif_quiet: "Quiet hours",
    notif_quiet_sub: "10pm – 8am",
    // Documents
    doc_title: "Documents",
    doc_sub: "Bills, contracts, account confirmations — searchable.",
    doc_search: "Search documents",
    doc_filter_all: "All",
    doc_filter_bills: "Bills",
    doc_filter_contracts: "Contracts",
    doc_upload: "Upload a document",
    doc_ocr: "OCR'd",
    // Premium
    prem_title: "LocateFlow Premium",
    prem_kicker: "FOR PEOPLE WITH MORE THAN ONE ROOF",
    prem_tagline: "Track every address you live in.",
    prem_price: "$8",
    prem_price_period: "/month",
    prem_yearly: "or $79/year — save $17",
    prem_features_title: "Everything in free, plus",
    prem_f1: "Unlimited addresses",
    prem_f1_sub: "Vacation home, rental, parents'",
    prem_f2: "Document OCR",
    prem_f2_sub: "Search any bill, contract, or letter",
    prem_f3: "State-specific moving rules",
    prem_f3_sub: "All 50 states, kept current",
    prem_f4: "Family sharing",
    prem_f4_sub: "Up to 4 members on one plan",
    prem_f5: "Priority support",
    prem_f5_sub: "Same-day replies, real humans",
    prem_cta: "Start 14-day free trial",
    prem_trust: "Cancel anytime · No credit card required",
    // Help
    help_title: "Help & support",
    help_search: "Search help articles",
    help_section_quick: "Quick links",
    help_q1: "How do I add a new service?",
    help_q2: "How do reminders work?",
    help_q3: "Is my data secure?",
    help_q4: "How do I cancel a subscription?",
    help_q5: "Can I share with family?",
    help_section_contact: "Still stuck?",
    help_email: "Email support",
    help_email_sub: "support@locateflow.app",
    help_chat: "Chat with us",
    help_chat_sub: "Mon–Fri · 9am – 6pm CT",
    help_status: "System status",
    help_status_sub: "All systems normal",
    common_back: "Back",
  },
  es: {
    more_title: "Más",
    more_subtitle: "Cuenta, facturación y más.",
    section_account: "Cuenta",
    section_app: "Aplicación",
    section_support: "Soporte",
    item_profile: "Perfil",
    item_profile_sub: "Jamie · 432 Oak St",
    item_payment: "Métodos de pago",
    item_payment_sub: "2 tarjetas · principal termina en 4242",
    item_notifications: "Notificaciones",
    item_notifications_sub: "12 recordatorios · resumen semanal",
    item_documents: "Documentos",
    item_documents_sub: "47 archivos · con OCR y búsqueda",
    item_premium: "LocateFlow Premium",
    item_premium_sub: "Direcciones ilimitadas · soporte prioritario",
    item_help: "Ayuda y soporte",
    item_help_sub: "Guías, contacto, estado",
    item_signout: "Cerrar sesión",
    profile_title: "Perfil",
    profile_name: "Nombre completo",
    profile_email: "Correo",
    profile_phone: "Teléfono",
    profile_address: "Dirección principal",
    profile_member: "Miembro desde",
    profile_save: "Guardar cambios",
    pay_title: "Métodos de pago",
    pay_default: "Principal",
    pay_add: "Añadir una nueva tarjeta",
    pay_billing_history: "Historial de facturación",
    pay_invoice: "Factura",
    notif_title: "Notificaciones",
    notif_section_reminders: "Recordatorios",
    notif_section_channels: "Cómo te avisamos",
    notif_renewals: "Avisos de renovación",
    notif_renewals_sub: "3 días antes de que se renueve un servicio",
    notif_pricehikes: "Subidas de precio",
    notif_pricehikes_sub: "Alerta cuando una factura sube",
    notif_unused: "Servicios sin uso",
    notif_unused_sub: "Marcar suscripciones sin uso en 30 días",
    notif_movetasks: "Tareas del día de mudanza",
    notif_movetasks_sub: "Paso a paso el día de la mudanza",
    notif_push: "Push",
    notif_email: "Correo",
    notif_sms: "SMS",
    notif_quiet: "Horas de silencio",
    notif_quiet_sub: "10pm – 8am",
    doc_title: "Documentos",
    doc_sub: "Facturas, contratos, confirmaciones — con búsqueda.",
    doc_search: "Buscar documentos",
    doc_filter_all: "Todo",
    doc_filter_bills: "Facturas",
    doc_filter_contracts: "Contratos",
    doc_upload: "Subir un documento",
    doc_ocr: "Con OCR",
    prem_title: "LocateFlow Premium",
    prem_kicker: "PARA QUIEN TIENE MÁS DE UN TECHO",
    prem_tagline: "Rastrea cada dirección donde vives.",
    prem_price: "$8",
    prem_price_period: "/mes",
    prem_yearly: "o $79/año — ahorra $17",
    prem_features_title: "Todo lo gratis, y además",
    prem_f1: "Direcciones ilimitadas",
    prem_f1_sub: "Casa de playa, alquiler, casa de tus padres",
    prem_f2: "OCR de documentos",
    prem_f2_sub: "Busca en cualquier factura, contrato o carta",
    prem_f3: "Reglas de mudanza por estado",
    prem_f3_sub: "Los 50 estados, siempre al día",
    prem_f4: "Plan familiar",
    prem_f4_sub: "Hasta 4 miembros en un plan",
    prem_f5: "Soporte prioritario",
    prem_f5_sub: "Respuesta el mismo día, gente real",
    prem_cta: "Empezar prueba de 14 días",
    prem_trust: "Cancela cuando quieras · Sin tarjeta requerida",
    help_title: "Ayuda y soporte",
    help_search: "Buscar artículos",
    help_section_quick: "Accesos rápidos",
    help_q1: "¿Cómo añado un nuevo servicio?",
    help_q2: "¿Cómo funcionan los recordatorios?",
    help_q3: "¿Mis datos están seguros?",
    help_q4: "¿Cómo cancelo una suscripción?",
    help_q5: "¿Puedo compartir con mi familia?",
    help_section_contact: "¿Sigues atascado?",
    help_email: "Correo de soporte",
    help_email_sub: "support@locateflow.app",
    help_chat: "Chatea con nosotros",
    help_chat_sub: "Lun–Vie · 9 – 18h CT",
    help_status: "Estado del sistema",
    help_status_sub: "Todo funciona con normalidad",
    common_back: "Atrás",
  },
};
const M = (lang, k) => (MORE_T[lang] && MORE_T[lang][k]) || k;

// ── Shared row component ─────────────────────────────────────────────────
function MoreRow({ icon, iconColor, iconBg, title, sub, badge, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      width: "100%",
      background: C.surface2,
      border: `1px solid ${C.border}`,
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
        width: 36, height: 36, borderRadius: 10,
        background: iconBg || "rgba(249,115,22,0.10)",
        border: `1px solid ${(iconColor || C.orangeLight) + "33"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: iconColor || C.orangeLight,
        flexShrink: 0,
      }}>
        <Icon name={icon} size={16}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: danger ? C.roseFg : C.fg }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      {badge && (
        <div style={{
          background: "rgba(249,115,22,0.12)",
          border: "1px solid rgba(249,115,22,0.3)",
          color: C.orangeLight,
          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 999,
        }}>
          {badge}
        </div>
      )}
      <span style={{ color: C.fg3, fontSize: 14 }}>›</span>
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
      color: C.fg3,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 18,
    }}>{children}</div>
  );
}

function PageHeader({ lang, title, sub, onBack }) {
  return (
    <>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.fg2, fontSize: 14, cursor: "pointer", marginBottom: 14, padding: 0, alignSelf: "flex-start", fontFamily: "inherit" }}>← {M(lang, "common_back")}</button>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>{title}</h1>
      {sub && <p style={{ fontSize: 13, color: C.fg2, lineHeight: 1.5, margin: "6px 0 18px" }}>{sub}</p>}
    </>
  );
}

// ── MORE — Index ────────────────────────────────────────────────────────
function MoreScreen({ lang, onNavigate }) {
  return (
    <div style={{ position: "absolute", inset: 0, paddingBottom: 100, overflowY: "auto" }}>
      <Blobs/>
      <div style={{ padding: "60px 24px 0" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>{M(lang, "more_title")}</h1>
        <p style={{ fontSize: 13, color: C.fg2, margin: "4px 0 0" }}>{M(lang, "more_subtitle")}</p>

        {/* Profile card hero */}
        <button onClick={() => onNavigate("profile")} style={{
          width: "100%",
          marginTop: 20,
          background: `linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,191,36,0.06))`,
          border: "1px solid rgba(249,115,22,0.25)",
          borderRadius: 18,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.orange}, ${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20, fontWeight: 700,
            flexShrink: 0,
          }}>JS</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em" }}>Jamie Soto</div>
            <div style={{ fontSize: 12, color: C.fg2, marginTop: 2 }}>jamie@example.com</div>
            <div style={{ fontSize: 10, color: C.orangeLight, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>FREE PLAN</div>
          </div>
          <span style={{ color: C.fg3, fontSize: 18 }}>›</span>
        </button>

        <SectionLabel>{M(lang, "section_account")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MoreRow icon="dollar" iconColor={C.emeraldFg} iconBg="rgba(16,185,129,0.10)" title={M(lang, "item_payment")} sub={M(lang, "item_payment_sub")} onClick={() => onNavigate("payment")}/>
          <MoreRow icon="bell" iconColor={C.skyFg} iconBg="rgba(14,165,233,0.10)" title={M(lang, "item_notifications")} sub={M(lang, "item_notifications_sub")} onClick={() => onNavigate("notifications")}/>
          <MoreRow icon="search" iconColor={C.amberFg} iconBg="rgba(245,158,11,0.10)" title={M(lang, "item_documents")} sub={M(lang, "item_documents_sub")} onClick={() => onNavigate("documents")}/>
        </div>

        <SectionLabel>{M(lang, "section_app")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MoreRow icon="zap" iconColor={C.orangeLight} iconBg="rgba(249,115,22,0.12)" title={M(lang, "item_premium")} sub={M(lang, "item_premium_sub")} badge="✦" onClick={() => onNavigate("premium")}/>
        </div>

        <SectionLabel>{M(lang, "section_support")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <MoreRow icon="alert" iconColor={C.fg2} iconBg="rgba(255,255,255,0.05)" title={M(lang, "item_help")} sub={M(lang, "item_help_sub")} onClick={() => onNavigate("help")}/>
        </div>

        <button style={{
          width: "100%",
          marginTop: 22,
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "12px 14px",
          color: C.roseFg,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "center",
        }}>
          {M(lang, "item_signout")}
        </button>

        <div style={{ fontSize: 10, color: C.fg3, textAlign: "center", marginTop: 18, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
          LOCATEFLOW · v2.4.1
        </div>
      </div>
    </div>
  );
}

// ── PROFILE ──────────────────────────────────────────────────────────────
function ProfileScreen({ lang, onBack }) {
  const [name, setName] = React.useState("Jamie Soto");
  const [email, setEmail] = React.useState("jamie@example.com");
  const [phone, setPhone] = React.useState("+1 (512) 555-0142");
  const [saved, setSaved] = React.useState(false);

  const InputField = ({ label, value, onChange }) => (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 10, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <input value={value} onChange={e => { onChange(e.target.value); setSaved(false); }} style={{
        width: "100%", background: "transparent", border: "none", color: C.fg,
        fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", padding: 0, boxSizing: "border-box",
      }}/>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 24px 100px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <Blobs/>
      <PageHeader lang={lang} title={M(lang, "profile_title")} onBack={onBack}/>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 8, marginBottom: 22 }}>
        <div style={{
          width: 76, height: 76, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.orange}, ${C.amber})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 28, fontWeight: 700,
          boxShadow: `0 12px 40px ${C.orange}40`,
        }}>JS</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <InputField label={M(lang, "profile_name")} value={name} onChange={setName}/>
        <InputField label={M(lang, "profile_email")} value={email} onChange={setEmail}/>
        <InputField label={M(lang, "profile_phone")} value={phone} onChange={setPhone}/>

        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 10, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{M(lang, "profile_address")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="pin" size={14} color={C.orangeLight}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>432 Oak St, Austin, TX</div>
          </div>
        </div>

        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 10, color: C.fg3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{M(lang, "profile_member")}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.fg2 }}>March 2024</div>
        </div>
      </div>

      <button onClick={() => setSaved(true)} style={{
        marginTop: 22,
        background: saved ? C.emerald : `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`,
        color: "#fff", border: "none",
        padding: "16px 20px", borderRadius: 14,
        fontSize: 15, fontWeight: 600, fontFamily: "inherit",
        cursor: "pointer",
        boxShadow: `0 12px 30px ${(saved ? C.emerald : C.orange)}30`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "200ms ease",
      }}>
        {saved ? <><Icon name="check" size={16}/> Saved</> : M(lang, "profile_save")}
      </button>
    </div>
  );
}

// ── PAYMENT METHODS ──────────────────────────────────────────────────────
function PaymentScreen({ lang, onBack }) {
  const cards = [
    { id: 1, brand: "VISA", last: "4242", exp: "08/27", isDefault: true, bg: "linear-gradient(135deg, #1e293b, #0f172a)" },
    { id: 2, brand: "MASTERCARD", last: "8801", exp: "11/26", isDefault: false, bg: "linear-gradient(135deg, #7c2d12, #431407)" },
  ];
  const history = [
    { date: "Apr 15, 2026", desc: "LocateFlow Premium", amount: 8.00 },
    { date: "Mar 15, 2026", desc: "LocateFlow Premium", amount: 8.00 },
    { date: "Feb 15, 2026", desc: "LocateFlow Premium", amount: 8.00 },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 24px 100px", overflowY: "auto" }}>
      <Blobs/>
      <PageHeader lang={lang} title={M(lang, "pay_title")} onBack={onBack}/>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map(card => (
          <div key={card.id} style={{
            background: card.bg,
            border: card.isDefault ? `1.5px solid ${C.orange}` : `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 18,
            position: "relative",
            boxShadow: card.isDefault ? `0 12px 32px ${C.orange}25` : "0 8px 20px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}/>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em" }}>{card.brand}</div>
              {card.isDefault && (
                <div style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: C.orange, color: "#fff", letterSpacing: "0.08em" }}>
                  {M(lang, "pay_default").toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "0.18em", fontFamily: "'JetBrains Mono', monospace" }}>•••• {card.last}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
              <span>EXP {card.exp}</span>
              <span>JAMIE SOTO</span>
            </div>
          </div>
        ))}

        <button style={{
          background: "transparent",
          border: `1.5px dashed ${C.borderStrong}`,
          borderRadius: 18,
          padding: "20px 14px",
          color: C.fg2,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Icon name="plus" size={16} color={C.orangeLight}/> {M(lang, "pay_add")}
        </button>
      </div>

      <SectionLabel>{M(lang, "pay_billing_history")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {history.map((h, i) => (
          <div key={i} style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{h.desc}</div>
              <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>{h.date}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.fg2, fontVariantNumeric: "tabular-nums" }}>${h.amount.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: C.orangeLight, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>{M(lang, "pay_invoice")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────
function NotificationsScreen({ lang, onBack }) {
  const [reminders, setReminders] = React.useState({
    renewals: true, pricehikes: true, unused: true, movetasks: true,
  });
  const [channels, setChannels] = React.useState({ push: true, email: true, sms: false });
  const [quiet, setQuiet] = React.useState(true);

  const Toggle = ({ on, onChange }) => (
    <button onClick={onChange} style={{
      width: 44, height: 26, borderRadius: 999,
      background: on ? C.orange : C.surface3,
      border: "none",
      position: "relative",
      cursor: "pointer",
      transition: "background 200ms ease",
      flexShrink: 0,
    }}>
      <div style={{
        position: "absolute",
        top: 3, left: on ? 21 : 3,
        width: 20, height: 20,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}/>
    </button>
  );

  const ToggleRow = ({ titleKey, subKey, on, onChange }) => (
    <div style={{
      background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{M(lang, titleKey)}</div>
        {subKey && <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, lineHeight: 1.4 }}>{M(lang, subKey)}</div>}
      </div>
      <Toggle on={on} onChange={onChange}/>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 24px 100px", overflowY: "auto" }}>
      <Blobs/>
      <PageHeader lang={lang} title={M(lang, "notif_title")} onBack={onBack}/>

      <SectionLabel>{M(lang, "notif_section_reminders")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ToggleRow titleKey="notif_renewals" subKey="notif_renewals_sub" on={reminders.renewals} onChange={() => setReminders(r => ({...r, renewals: !r.renewals}))}/>
        <ToggleRow titleKey="notif_pricehikes" subKey="notif_pricehikes_sub" on={reminders.pricehikes} onChange={() => setReminders(r => ({...r, pricehikes: !r.pricehikes}))}/>
        <ToggleRow titleKey="notif_unused" subKey="notif_unused_sub" on={reminders.unused} onChange={() => setReminders(r => ({...r, unused: !r.unused}))}/>
        <ToggleRow titleKey="notif_movetasks" subKey="notif_movetasks_sub" on={reminders.movetasks} onChange={() => setReminders(r => ({...r, movetasks: !r.movetasks}))}/>
      </div>

      <SectionLabel>{M(lang, "notif_section_channels")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ToggleRow titleKey="notif_push" on={channels.push} onChange={() => setChannels(c => ({...c, push: !c.push}))}/>
        <ToggleRow titleKey="notif_email" on={channels.email} onChange={() => setChannels(c => ({...c, email: !c.email}))}/>
        <ToggleRow titleKey="notif_sms" on={channels.sms} onChange={() => setChannels(c => ({...c, sms: !c.sms}))}/>
        <ToggleRow titleKey="notif_quiet" subKey="notif_quiet_sub" on={quiet} onChange={() => setQuiet(q => !q)}/>
      </div>
    </div>
  );
}

// ── DOCUMENTS ────────────────────────────────────────────────────────────
function DocumentsScreen({ lang, onBack }) {
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const docs = [
    { id: 1, name: "PG&E March bill", type: "bills", date: "Mar 28, 2026", size: "248 KB", color: C.amberFg, bg: "rgba(245,158,11,0.10)" },
    { id: 2, name: "Geico auto policy 2026", type: "contracts", date: "Mar 12, 2026", size: "1.4 MB", color: C.emeraldFg, bg: "rgba(16,185,129,0.10)" },
    { id: 3, name: "Comcast service agreement", type: "contracts", date: "Feb 04, 2026", size: "892 KB", color: C.emeraldFg, bg: "rgba(16,185,129,0.10)" },
    { id: 4, name: "Verizon February bill", type: "bills", date: "Feb 19, 2026", size: "192 KB", color: C.amberFg, bg: "rgba(245,158,11,0.10)" },
    { id: 5, name: "Renters insurance policy", type: "contracts", date: "Jan 22, 2026", size: "2.1 MB", color: C.emeraldFg, bg: "rgba(16,185,129,0.10)" },
    { id: 6, name: "Netflix payment receipt", type: "bills", date: "Jan 14, 2026", size: "84 KB", color: C.amberFg, bg: "rgba(245,158,11,0.10)" },
  ];
  const filtered = docs
    .filter(d => filter === "all" || d.type === filter)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 24px 100px", overflowY: "auto" }}>
      <Blobs/>
      <PageHeader lang={lang} title={M(lang, "doc_title")} sub={M(lang, "doc_sub")} onBack={onBack}/>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.fg3 }}>
          <Icon name="search" size={16}/>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={M(lang, "doc_search")}
          style={{
            width: "100%",
            padding: "12px 12px 12px 40px",
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            color: C.fg,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { k: "all", l: "doc_filter_all" },
          { k: "bills", l: "doc_filter_bills" },
          { k: "contracts", l: "doc_filter_contracts" },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            background: filter === f.k ? C.orange : "transparent",
            border: `1px solid ${filter === f.k ? C.orange : C.border}`,
            color: filter === f.k ? "#fff" : C.fg2,
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer",
          }}>{M(lang, f.l)}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(d => (
          <div key={d.id} style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 12,
            cursor: "pointer",
          }}>
            <div style={{
              width: 36, height: 44, borderRadius: 6,
              background: d.bg,
              border: `1px solid ${d.color}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, position: "relative",
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: d.color, letterSpacing: "0.05em" }}>PDF</div>
              <div style={{ position: "absolute", top: 2, right: 2, width: 0, height: 0, borderTop: `8px solid ${C.surface}`, borderLeft: `8px solid transparent` }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, display: "flex", gap: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                <span>{d.date}</span>
                <span>·</span>
                <span>{d.size}</span>
                <span>·</span>
                <span style={{ color: C.emeraldFg }}>{M(lang, "doc_ocr")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button style={{
        width: "100%", marginTop: 14,
        background: "transparent",
        border: `1.5px dashed ${C.borderStrong}`,
        borderRadius: 14,
        padding: "14px",
        color: C.fg2,
        fontSize: 13, fontWeight: 600,
        fontFamily: "inherit", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="plus" size={16} color={C.orangeLight}/> {M(lang, "doc_upload")}
      </button>
    </div>
  );
}

// ── PREMIUM ──────────────────────────────────────────────────────────────
function PremiumScreen({ lang, onBack }) {
  const features = [
    { titleKey: "prem_f1", subKey: "prem_f1_sub", icon: "pin" },
    { titleKey: "prem_f2", subKey: "prem_f2_sub", icon: "search" },
    { titleKey: "prem_f3", subKey: "prem_f3_sub", icon: "truck" },
    { titleKey: "prem_f4", subKey: "prem_f4_sub", icon: "home" },
    { titleKey: "prem_f5", subKey: "prem_f5_sub", icon: "bell" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, paddingBottom: 100, overflowY: "auto" }}>
      <Blobs/>
      <div style={{
        background: `linear-gradient(180deg, rgba(249,115,22,0.18) 0%, transparent 100%)`,
        padding: "60px 24px 24px",
        position: "relative",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.fg2, fontSize: 14, cursor: "pointer", marginBottom: 14, padding: 0, fontFamily: "inherit" }}>← {M(lang, "common_back")}</button>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: `linear-gradient(135deg, ${C.orange}, ${C.amber})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 28, fontWeight: 700,
            boxShadow: `0 16px 40px ${C.orange}50`,
          }}>✦</div>
        </div>

        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.orangeLight, letterSpacing: "0.2em", textAlign: "center", marginBottom: 8 }}>
          {M(lang, "prem_kicker")}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.2, margin: 0, textAlign: "center", color: C.fg }}>
          {M(lang, "prem_tagline")}
        </h1>

        <div style={{ textAlign: "center", marginTop: 18, marginBottom: 4 }}>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: C.fg, fontVariantNumeric: "tabular-nums" }}>{M(lang, "prem_price")}</span>
          <span style={{ fontSize: 16, color: C.fg2, fontWeight: 500 }}>{M(lang, "prem_price_period")}</span>
        </div>
        <div style={{ fontSize: 11, color: C.fg3, textAlign: "center" }}>{M(lang, "prem_yearly")}</div>
      </div>

      <div style={{ padding: "8px 24px 24px" }}>
        <SectionLabel>{M(lang, "prem_features_title")}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 14,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(249,115,22,0.10)",
                border: "1px solid rgba(249,115,22,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.orangeLight, flexShrink: 0,
              }}>
                <Icon name={f.icon} size={16}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{M(lang, f.titleKey)}</div>
                <div style={{ fontSize: 11, color: C.fg3, marginTop: 2, lineHeight: 1.4 }}>{M(lang, f.subKey)}</div>
              </div>
              <Icon name="check" size={18} color={C.emeraldFg} strokeWidth={2.5}/>
            </div>
          ))}
        </div>

        <button style={{
          width: "100%", marginTop: 22,
          background: `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`,
          color: "#fff", border: "none",
          padding: "18px 20px", borderRadius: 14,
          fontSize: 16, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: `0 16px 40px ${C.orange}40`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {M(lang, "prem_cta")} <Icon name="arrow" size={18}/>
        </button>
        <div style={{ fontSize: 11, color: C.fg3, textAlign: "center", marginTop: 12 }}>
          {M(lang, "prem_trust")}
        </div>
      </div>
    </div>
  );
}

// ── HELP ─────────────────────────────────────────────────────────────────
function HelpScreen({ lang, onBack }) {
  const [search, setSearch] = React.useState("");
  const questions = ["help_q1", "help_q2", "help_q3", "help_q4", "help_q5"];

  return (
    <div style={{ position: "absolute", inset: 0, padding: "60px 24px 100px", overflowY: "auto" }}>
      <Blobs/>
      <PageHeader lang={lang} title={M(lang, "help_title")} onBack={onBack}/>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.fg3 }}>
          <Icon name="search" size={16}/>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={M(lang, "help_search")}
          style={{
            width: "100%",
            padding: "12px 12px 12px 40px",
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            color: C.fg, fontSize: 13,
            fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <SectionLabel>{M(lang, "help_section_quick")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {questions.map(q => (
          <button key={q} style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "12px 14px",
            color: C.fg, fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            textAlign: "left",
          }}>
            <span>{M(lang, q)}</span>
            <span style={{ color: C.fg3, fontSize: 14 }}>›</span>
          </button>
        ))}
      </div>

      <SectionLabel>{M(lang, "help_section_contact")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <MoreRow icon="bell" iconColor={C.orangeLight} iconBg="rgba(249,115,22,0.10)" title={M(lang, "help_email")} sub={M(lang, "help_email_sub")}/>
        <MoreRow icon="search" iconColor={C.skyFg} iconBg="rgba(14,165,233,0.10)" title={M(lang, "help_chat")} sub={M(lang, "help_chat_sub")}/>
        <div style={{
          background: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.22)",
          borderRadius: 14, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.emerald, boxShadow: `0 0 8px ${C.emerald}`, flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{M(lang, "help_status")}</div>
            <div style={{ fontSize: 11, color: C.emeraldFg, marginTop: 2 }}>{M(lang, "help_status_sub")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MoreScreen, ProfileScreen, PaymentScreen, NotificationsScreen, DocumentsScreen, PremiumScreen, HelpScreen });
