"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus, ChevronRight, Loader2, Mail, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { LEGAL_CONTACTS, mailto } from "@/lib/legal-info";

const statusClasses: Record<string, string> = {
  OPEN: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  IN_PROGRESS: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  WAITING_USER: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br",
  CLOSED: "bg-foreground/5 text-muted-foreground border-border",
};

const SUPPORT_COPY = {
  en: {
    command: "Support command",
    title: "Support",
    subtitle: "View and manage your support tickets",
    newTicket: "New Ticket",
    stats: { total: "Total", open: "Open", waiting: "Waiting" },
    emailTitle: "Email support",
    ticketTitle: "Open a support ticket",
    ticketSubtitle: "Create and track requests right here",
    modalTitle: "New Support Ticket",
    subject: "Subject",
    subjectPlaceholder: "Brief description of your issue",
    category: "Category",
    priority: "Priority",
    message: "Message",
    messagePlaceholder: "Describe your issue in detail...",
    submit: "Submit Ticket",
    cancel: "Cancel",
    noTickets: "No support tickets yet",
    noTicketsHint: "Create a ticket if you need help with anything",
    validation: "Message must be at least 10 characters.",
    success: "Ticket created successfully.",
    failure: "Failed to create ticket.",
    messageCount: "msg",
    messageCountPlural: "msgs",
    supportPrefix: "Support: ",
    userPrefix: "You: ",
    status: {
      OPEN: "Open",
      IN_PROGRESS: "In Progress",
      WAITING_USER: "Waiting for you",
      CLOSED: "Closed",
    },
    categories: {
      GENERAL: "General",
      BUG: "Bug Report",
      BILLING: "Billing",
      ACCOUNT: "Account",
      FEATURE_REQUEST: "Feature Request",
    },
    priorities: {
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      URGENT: "Urgent",
    },
  },
  es: {
    command: "Comando de soporte",
    title: "Soporte",
    subtitle: "Consulta y administra tus tickets de soporte",
    newTicket: "Nuevo ticket",
    stats: { total: "Total", open: "Abiertos", waiting: "En espera" },
    emailTitle: "Soporte por email",
    ticketTitle: "Abrir un ticket",
    ticketSubtitle: "Crea y sigue solicitudes desde aqui",
    modalTitle: "Nuevo ticket de soporte",
    subject: "Asunto",
    subjectPlaceholder: "Descripcion breve del problema",
    category: "Categoria",
    priority: "Prioridad",
    message: "Mensaje",
    messagePlaceholder: "Describe tu problema en detalle...",
    submit: "Enviar ticket",
    cancel: "Cancelar",
    noTickets: "Aun no hay tickets",
    noTicketsHint: "Crea un ticket si necesitas ayuda",
    validation: "El mensaje debe tener al menos 10 caracteres.",
    success: "Ticket creado correctamente.",
    failure: "No se pudo crear el ticket.",
    messageCount: "msg",
    messageCountPlural: "msgs",
    supportPrefix: "Soporte: ",
    userPrefix: "Tu: ",
    status: {
      OPEN: "Abierto",
      IN_PROGRESS: "En progreso",
      WAITING_USER: "Esperando respuesta",
      CLOSED: "Cerrado",
    },
    categories: {
      GENERAL: "General",
      BUG: "Reporte de error",
      BILLING: "Facturacion",
      ACCOUNT: "Cuenta",
      FEATURE_REQUEST: "Solicitud de funcion",
    },
    priorities: {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      URGENT: "Urgente",
    },
  },
} as const;

const categoryOrder = ["GENERAL", "BUG", "BILLING", "ACCOUNT", "FEATURE_REQUEST"] as const;
const priorityOrder = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: { content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? SUPPORT_COPY.es : SUPPORT_COPY.en;
}

export default function SupportPage() {
  const locale = useLocale();
  const copy = copyForLocale(locale);
  const dateLocale = locale.toLowerCase().startsWith("es") ? "es-US" : "en-US";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "GENERAL", priority: "MEDIUM", message: "" });

  const fetchTickets = useCallback(async () => {
    const res = await fetch("/api/tickets");
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets || []);
    }
  }, []);

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.message.length < 10) {
      toast.error(copy.validation);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(copy.success);
        setShowCreate(false);
        setForm({ subject: "", category: "GENERAL", priority: "MEDIUM", message: "" });
        await fetchTickets();
      } else {
        const d = await res.json();
        toast.error(d.error || copy.failure);
      }
    } finally {
      setCreating(false);
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status !== "CLOSED").length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "WAITING_USER").length;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.command}</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">{copy.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {copy.newTicket}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            [copy.stats.total, tickets.length],
            [copy.stats.open, openCount],
            [copy.stats.waiting, waitingCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-background/55 p-3">
              <p className="text-lg font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={mailto(LEGAL_CONTACTS.support)}
          className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-tone-sky-br"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-tone-sky-br bg-tone-sky-bg">
            <Mail className="h-4 w-4 text-tone-sky-fg" />
          </div>
          <p className="text-sm font-semibold text-foreground">{copy.emailTitle}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{LEGAL_CONTACTS.support}</p>
        </a>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-2xl border border-border bg-card/70 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-tone-orange-br"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-tone-orange-br bg-tone-orange-bg">
            <MessageCircle className="h-4 w-4 text-tone-orange-fg" />
          </div>
          <p className="text-sm font-semibold text-foreground">{copy.ticketTitle}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{copy.ticketSubtitle}</p>
        </button>
      </div>

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-ticket-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreate(false);
          }}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="support-ticket-title" className="text-base font-semibold text-foreground">
                {copy.modalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full p-1 text-foreground/45 transition hover:bg-foreground/5 hover:text-foreground"
                aria-label={copy.cancel}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{copy.subject}</label>
                <input
                  className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder={copy.subjectPlaceholder}
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  minLength={5}
                  maxLength={255}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{copy.category}</label>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {categoryOrder.map((value) => (
                      <option key={value} value={value}>
                        {copy.categories[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{copy.priority}</label>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  >
                    {priorityOrder.map((value) => (
                      <option key={value} value={value}>
                        {copy.priorities[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{copy.message}</label>
                <textarea
                  className="w-full resize-none rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder={copy.messagePlaceholder}
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  minLength={10}
                  maxLength={5000}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {copy.submit}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {copy.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card/70 p-12 text-center shadow-sm">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-foreground/20" />
          <p className="text-sm text-muted-foreground">{copy.noTickets}</p>
          <p className="mt-1 text-xs text-foreground/30">{copy.noTicketsHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const statusClass = statusClasses[ticket.status] || statusClasses.OPEN;
            const lastMsg = ticket.messages[0];
            const countLabel = ticket._count.messages === 1 ? copy.messageCount : copy.messageCountPlural;
            return (
              <Link key={ticket.id} href={`/support/${ticket.id}`}>
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>
                        {copy.status[ticket.status as keyof typeof copy.status] || ticket.status}
                      </span>
                      <span className="text-[10px] text-foreground/35">
                        {copy.categories[ticket.category as keyof typeof copy.categories] || ticket.category}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                    {lastMsg ? (
                      <p className="mt-0.5 truncate text-xs text-foreground/40">
                        {lastMsg.senderType === "ADMIN" ? copy.supportPrefix : copy.userPrefix}
                        {lastMsg.content}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-foreground/30">
                        {ticket._count.messages} {countLabel}
                      </p>
                      <p className="mt-0.5 text-[10px] text-foreground/30">
                        {new Date(ticket.updatedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-foreground/30" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
