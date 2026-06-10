"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, MessageCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br" },
  WAITING_USER: { label: "Waiting for you", cls: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br" },
  CLOSED: { label: "Closed", cls: "bg-foreground/5 text-muted-foreground border-border" },
};

interface Message {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  messages: Message[];
}

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket().finally(() => setLoading(false));
  }, [fetchTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });
      if (res.ok) {
        setReply("");
        await fetchTicket();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to send reply.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Ticket closed.");
        await fetchTicket();
      } else {
        toast.error("Failed to close ticket.");
      }
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Ticket not found.</p>
        <Link href="/support" className="text-tone-orange-fg text-sm mt-2 inline-block">← Back to Support</Link>
      </div>
    );
  }

  const badge = statusBadge[ticket.status] || statusBadge.OPEN;
  const isClosed = ticket.status === "CLOSED";

  return (
    <div className="space-y-5 pb-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/support">
          <button className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
            <span className="text-[10px] text-foreground/35">{ticket.category}</span>
            <span className="text-[10px] text-foreground/35">#{ticket.id.slice(-6)}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1">{ticket.subject}</h1>
          <p className="text-xs text-foreground/40 mt-0.5">
            Opened {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {!isClosed && (
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs hover:text-destructive hover:border-destructive/30 transition"
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Close Ticket
          </button>
        )}
      </div>

      {/* Thread */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] overflow-hidden">
        <div className="divide-y divide-foreground/[0.04]">
          {ticket.messages.map((msg) => {
            const isUser = msg.senderType === "USER";
            const isSystem = msg.senderType === "SYSTEM";
            return (
              <div key={msg.id} className={`p-4 ${isSystem ? "bg-foreground/[0.01]" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    isUser ? "bg-tone-orange-bg text-tone-orange-fg" :
                    isSystem ? "bg-foreground/5 text-foreground/40" :
                    "bg-tone-cyan-bg text-tone-cyan-fg"
                  }`}>
                    {isUser ? "U" : isSystem ? "⚙" : "S"}
                  </div>
                  <span className={`text-xs font-medium ${isUser ? "text-tone-orange-fg" : isSystem ? "text-foreground/40" : "text-tone-cyan-fg"}`}>
                    {isUser ? "You" : isSystem ? "System" : "Support"}
                  </span>
                  <span className="text-[10px] text-foreground/30">
                    {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isSystem ? "text-foreground/40 italic" : "text-foreground/80"}`}>
                  {msg.content}
                </p>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply form */}
      {isClosed ? (
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4 text-center">
          <MessageCircle className="h-5 w-5 text-foreground/20 mx-auto mb-1" />
          <p className="text-xs text-foreground/40">This ticket is closed. <Link href="/support" className="text-tone-orange-fg hover:underline">Open a new ticket</Link> if you need further help.</p>
        </div>
      ) : (
        <form onSubmit={handleReply} className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
          <textarea
            className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-tone-orange-br resize-none mb-3"
            placeholder="Write your reply..."
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Reply
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
