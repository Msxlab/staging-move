"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { User, Bell, CreditCard, Download, Shield, DollarSign, Link2, MapPin, Users, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useLocale } from "next-intl";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { UIPreferencesCard } from "@/components/settings/ui-preferences-card";
import { PasswordInput } from "@/components/ui/password-input";

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
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showBudget, setShowBudget] = useState<boolean | null>(null);
  const [hasPasswordLogin, setHasPasswordLogin] = useState<boolean | null>(null);

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
        if (!cancelled) setHasPasswordLogin(data.account?.hasPasswordLogin === true);
      })
      .catch(() => {
        if (!cancelled) setHasPasswordLogin(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetDeleteFlow = () => {
    setDeleteStep("idle");
    setConfirmText("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = async () => {
    const oauthOnly = hasPasswordLogin === false;
    if (confirmText !== "DELETE" || (!oauthOnly && !confirmPassword)) return;
    setDeleteStep("deleting");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmText,
          ...(oauthOnly ? { confirmAccountDeletion: true } : { confirmPassword }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
          body: "{}",
          cache: "no-store",
        }).catch(() => {});
        toast.success(data.message || copy.danger.success);
        setTimeout(() => { window.location.href = "/"; }, 1500);
      } else {
        toast.error(data.error || copy.danger.failure);
        setDeleteStep("confirm");
      }
    } catch {
      toast.error(copy.danger.failure);
      setDeleteStep("confirm");
    }
  };

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
            {deleteStep === "idle" && (
              <button
                onClick={() => setDeleteStep("confirm")}
                className="self-start rounded-xl border border-destructive bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive sm:self-auto"
              >
                {copy.danger.deleteAccount}
              </button>
            )}
          </div>
          {deleteStep !== "idle" && (
            <div className="rounded-xl border border-destructive bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {copy.danger.confirmIntro} <span className="font-semibold text-destructive">{copy.danger.irreversible}</span>. {copy.danger.confirmBody}
              </p>
              {hasPasswordLogin === false && (
                <p className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-xs text-tone-honey-fg/80">
                  {copy.danger.oauthOnly}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{copy.danger.typeDelete}</label>
                <input
                  className="w-full rounded-xl border border-destructive bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/30"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={deleteStep === "deleting"}
                />
              </div>
              {hasPasswordLogin !== false && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{copy.danger.password}</label>
                  <PasswordInput
                    className="w-full rounded-xl border border-destructive bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/30"
                    autoComplete="current-password"
                    placeholder={copy.danger.passwordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={deleteStep === "deleting"}
                  />
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || (hasPasswordLogin !== false && !confirmPassword) || deleteStep === "deleting"}
                  className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white transition hover:bg-destructive/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteStep === "deleting" ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.danger.deleting}</> : copy.danger.finalDelete}
                </button>
                <button
                  onClick={resetDeleteFlow}
                  disabled={deleteStep === "deleting"}
                  className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
                >
                  {copy.danger.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
