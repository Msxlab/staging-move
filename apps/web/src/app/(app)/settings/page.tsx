"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { User, Bell, CreditCard, Download, Shield, DollarSign, Link2, MapPin, Users, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { UIPreferencesCard } from "@/components/settings/ui-preferences-card";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

const SETTINGS_COPY = {
  en: {
    command: "Account command",
    title: "Settings",
    subtitle: "Manage plan, privacy, workspace, notifications, appearance, and exports from one operational hub.",
    cards: {
      planLabel: "Plan & billing",
      planValue: "Subscription ready",
      securityLabel: "Security",
      securityValue: "Privacy controls",
      workspaceLabel: "Workspace",
      workspaceValue: "Members & roles",
    },
    features: "Features",
    account: "Account",
    budget: { title: "Budget", description: "Track monthly expenses and spending" },
    sections: [
      { title: "Profile", description: "Manage your personal info and preferences", icon: User, href: "/settings/profile" },
      { title: "Notifications", description: "Configure in-app and email reminders", icon: Bell, href: "/settings/notifications" },
      { title: "Subscription", description: "Manage your plan and billing", icon: CreditCard, href: "/settings/subscription" },
      { title: "Connections", description: "Link partners to auto-update your address", icon: Link2, href: "/settings/connections" },
      { title: "Address change history", description: "See where each address change was sent", icon: MapPin, href: "/settings/address-changes" },
      { title: "Workspace", description: "Members, roles, and invitations", icon: Users, href: "/settings/workspace" },
      { title: "Data Export", description: "Export your data as PDF or CSV", icon: Download, href: "/settings/export" },
      { title: "Privacy & Security", description: "Password, 2FA, and data privacy", icon: Shield, href: "/settings/privacy" },
    ],
    danger: {
      title: "Danger Zone",
      deleteAccount: "Delete Account",
      deleteBody: "Permanently delete your account and all data",
      confirmIntro: "This action is",
      irreversible: "irreversible",
      confirmBody: "All your addresses, services, documents, moving plans, and account data will be permanently deleted.",
      oauthOnly: "Your Google or Apple sign-in session is already verified. No password setup is required.",
      typeDelete: "Type DELETE to confirm",
      password: "Confirm your password",
      passwordPlaceholder: "Password",
      deleting: "Deleting...",
      finalDelete: "Permanently Delete My Account",
      cancel: "Cancel",
      success: "Account deletion initiated. Redirecting...",
      failure: "Failed to delete account",
    },
  },
  es: {
    command: "Comando de cuenta",
    title: "Configuracion",
    subtitle: "Administra plan, privacidad, workspace, notificaciones, apariencia y exportaciones desde un solo lugar.",
    cards: {
      planLabel: "Plan y facturacion",
      planValue: "Suscripcion lista",
      securityLabel: "Seguridad",
      securityValue: "Controles de privacidad",
      workspaceLabel: "Workspace",
      workspaceValue: "Miembros y roles",
    },
    features: "Funciones",
    account: "Cuenta",
    budget: { title: "Presupuesto", description: "Rastrea gastos mensuales y costos" },
    sections: [
      { title: "Perfil", description: "Administra tu informacion personal y preferencias", icon: User, href: "/settings/profile" },
      { title: "Notificaciones", description: "Configura recordatorios en app y por email", icon: Bell, href: "/settings/notifications" },
      { title: "Suscripcion", description: "Administra tu plan y facturacion", icon: CreditCard, href: "/settings/subscription" },
      { title: "Conexiones", description: "Vincula partners para actualizar tu direccion", icon: Link2, href: "/settings/connections" },
      { title: "Historial de cambios", description: "Ve donde se envio cada cambio de direccion", icon: MapPin, href: "/settings/address-changes" },
      { title: "Workspace", description: "Miembros, roles e invitaciones", icon: Users, href: "/settings/workspace" },
      { title: "Exportar datos", description: "Exporta tus datos como PDF o CSV", icon: Download, href: "/settings/export" },
      { title: "Privacidad y seguridad", description: "Password, 2FA y privacidad de datos", icon: Shield, href: "/settings/privacy" },
    ],
    danger: {
      title: "Zona de riesgo",
      deleteAccount: "Eliminar cuenta",
      deleteBody: "Elimina permanentemente tu cuenta y todos los datos",
      confirmIntro: "Esta accion es",
      irreversible: "irreversible",
      confirmBody: "Tus direcciones, servicios, documentos, planes de mudanza y datos de cuenta se eliminaran permanentemente.",
      oauthOnly: "Tu sesion con Google o Apple ya esta verificada. No necesitas crear una contrasena.",
      typeDelete: "Escribe DELETE para confirmar",
      password: "Confirma tu contrasena",
      passwordPlaceholder: "Contrasena",
      deleting: "Eliminando...",
      finalDelete: "Eliminar mi cuenta permanentemente",
      cancel: "Cancelar",
      success: "Eliminacion de cuenta iniciada. Redirigiendo...",
      failure: "No se pudo eliminar la cuenta",
    },
  },
} as const;

type SettingsSection = {
  title: string;
  description: string;
  icon: ElementType;
  href: string;
};

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? SETTINGS_COPY.es : SETTINGS_COPY.en;
}

function SectionList({ items }: { items: readonly SettingsSection[] }) {
  return (
    <div className="space-y-2">
      {items.map((section) => (
        <Link key={section.title} href={section.href}>
          <div className="group flex items-center gap-3 rounded-xl border border-border bg-background/55 p-3.5 transition hover:border-primary/30 hover:bg-accent/40">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-semibold text-foreground">{section.title}</h3>
              <p className="truncate text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const locale = useLocale();
  const copy = copyForLocale(locale);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showBudget, setShowBudget] = useState<boolean | null>(null);
  const [hasPasswordLogin, setHasPasswordLogin] = useState<boolean | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setShowBudget(Boolean(data.showBudget));
      })
      .catch(() => {
        if (!cancelled) setShowBudget(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/security", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) {
          setHasPasswordLogin(data.account?.hasPasswordLogin === true);
          setMfaEnabled(data.account?.mfaEnabled === true);
          setUserEmail(typeof data.account?.email === "string" ? data.account.email : null);
        }
      })
      .catch(() => {
        if (!cancelled) setHasPasswordLogin(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const budgetFeature = {
    title: copy.budget.title,
    description: copy.budget.description,
    icon: DollarSign,
    href: "/budget",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <section className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
        <div className="border-b border-border bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_100%)] p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.command}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-foreground md:text-3xl">{copy.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/55 p-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{copy.cards.planLabel}</p>
            <p className="mt-1 font-display text-sm font-semibold text-foreground">{copy.cards.planValue}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/55 p-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{copy.cards.securityLabel}</p>
            <p className="mt-1 font-display text-sm font-semibold text-foreground">{copy.cards.securityValue}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/55 p-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{copy.cards.workspaceLabel}</p>
            <p className="mt-1 font-display text-sm font-semibold text-foreground">{copy.cards.workspaceValue}</p>
          </div>
        </div>
      </section>

      {showBudget === true && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.features}</h2>
          </div>
          <div className="px-4 pb-4">
            <SectionList items={[budgetFeature]} />
          </div>
        </div>
      )}

      <UIPreferencesCard />

      <AppearanceCard />

      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
        <div className="px-5 pt-5 pb-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.account}</h2>
        </div>
        <div className="px-4 pb-4">
          <SectionList items={copy.sections} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-destructive/50 bg-destructive/5 shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-display text-sm font-semibold text-destructive">{copy.danger.title}</h3>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground/80">{copy.danger.deleteAccount}</p>
              <p className="text-xs text-foreground/40">{copy.danger.deleteBody}</p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="self-start rounded-xl border border-destructive bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive sm:self-auto"
            >
              {copy.danger.deleteAccount}
            </button>
          </div>
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userEmail={userEmail}
        hasPasswordLogin={hasPasswordLogin ?? true}
        mfaEnabled={mfaEnabled}
      />
    </div>
  );
}
