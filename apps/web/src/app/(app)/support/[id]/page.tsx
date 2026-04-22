"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, MessageCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  WAITING_USER: { label: "Waiting for you", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  CLOSED: { label: "Closed", cls: "bg-white/5 text-white/40 border-white/10" },
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
        <Loader2 className="h-6 w-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16">
        <p className="text-white/40">Ticket not found.</p>
        <Link href="/support" className="text-orange-400 text-sm mt-2 inline-block">← Back to Support</Link>
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
          <button className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
            <span className="text-[10px] text-white/25">{ticket.category}</span>
            <span className="text-[10px] text-white/25">#{ticket.id.slice(-6)}</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">{ticket.subject}</h1>
          <p className="text-xs text-white/30 mt-0.5">
            Opened {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {!isClosed && (
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-white/40 text-xs hover:text-red-400 hover:border-red-500/30 transition"
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Close Ticket
          </button>
        )}
      </div>

      {/* Thread */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {ticket.messages.map((msg) => {
            const isUser = msg.senderType === "USER";
            const isSystem = msg.senderType === "SYSTEM";
            return (
              <div key={msg.id} className={`p-4 ${isSystem ? "bg-white/[0.01]" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    isUser ? "bg-orange-500/20 text-orange-400" :
                    isSystem ? "bg-white/5 text-white/30" :
                    "bg-cyan-500/20 text-cyan-400"
                  }`}>
                    {isUser ? "U" : isSystem ? "⚙" : "S"}
                  </div>
                  <span className={`text-xs font-medium ${isUser ? "text-orange-300" : isSystem ? "text-white/30" : "text-cyan-300"}`}>
                    {isUser ? "You" : isSystem ? "System" : "Support"}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isSystem ? "text-white/30 italic" : "text-white/70"}`}>
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
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <MessageCircle className="h-5 w-5 text-white/10 mx-auto mb-1" />
          <p className="text-xs text-white/30">This ticket is closed. <Link href="/support" className="text-orange-400 hover:underline">Open a new ticket</Link> if you need further help.</p>
        </div>
      ) : (
        <form onSubmit={handleReply} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <textarea
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 resize-none mb-3"
            placeholder="Write your reply..."
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
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
