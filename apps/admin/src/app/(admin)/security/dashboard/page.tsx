"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Shield, ShieldAlert, Monitor, Clock, XCircle, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight, Power, Globe, Smartphone, Laptop, ArrowLeft,
  AlertTriangle, KeyRound, Eye, Ban, RefreshCw, Download,
} from "lucide-react";

type Tab = "sessions" | "login-history" | "events";

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function SecurityDashboardPage() {
  const [tab, setTab] = useState<Tab>("sessions");
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [loginStats, setLoginStats] = useState<any>({});
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loginPage, setLoginPage] = useState(1);
  const [loginTotal, setLoginTotal] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const [successFilter, setSuccessFilter] = useState("");

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/sessions?all=${showAll}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setCurrentAdminId(data.currentAdminId || "");
      setIsSuperAdmin(data.isSuperAdmin || false);
    } catch { toast.error("Failed to load sessions"); }
  }, [showAll]);

  const loadLoginHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(loginPage), perPage: "30", all: String(showAll) });
      if (successFilter) params.set("success", successFilter);
      const res = await fetch(`/api/auth/login-history?${params}`);
      const data = await res.json();
      setLoginLogs(data.logs || []);
      setLoginTotal(data.total || 0);
      setLoginStats(data.stats || {});
      if (data.isSuperAdmin !== undefined) setIsSuperAdmin(data.isSuperAdmin);
    } catch { toast.error("Failed to load login history"); }
  }, [loginPage, showAll, successFilter]);

  const loadSecurityEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?tab=admin&action=SECURITY_ALERT&perPage=50&page=1");
      const data = await res.json();
      setSecurityEvents(data.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSessions(), loadLoginHistory(), loadSecurityEvents()]).finally(() => setLoading(false));
  }, [loadSessions, loadLoginHistory, loadSecurityEvents]);

  async function revokeSession(sessionId: string) {
    if (!confirm("Revoke this session? The admin will be signed out.")) return;
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", sessionId }),
      });
      if (res.ok) {
        toast.success("Session revoked");
        loadSessions();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to revoke");
      }
    } catch { toast.error("Failed to revoke session"); }
  }

  async function revokeAllSessions(scope: string) {
    const msg = scope === "all" ? "Revoke ALL admin sessions? Everyone will be signed out." : "Revoke all your sessions?";
    if (!confirm(msg)) return;
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_all", revokeAll: scope }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.revoked || 0} sessions revoked`);
        loadSessions();
      }
    } catch { toast.error("Failed"); }
  }

  const activeSessions = sessions.filter((s) => s.isActive);
  const loginPageCount = Math.ceil(loginTotal / 30);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/security" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Active sessions, login history, and security events</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Sessions</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{activeSessions.length}</p>
            </div>
            <div className="rounded-lg bg-tone-sage-bg p-2.5"><Monitor className="h-5 w-5 text-tone-sage-fg" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Logins (24h)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{loginStats.total24h || 0}</p>
            </div>
            <div className="rounded-lg bg-tone-sky-bg p-2.5"><KeyRound className="h-5 w-5 text-tone-sky-fg" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Failed (24h)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{loginStats.failed24h || 0}</p>
            </div>
            <div className={`rounded-lg p-2.5 ${(loginStats.failed24h || 0) > 5 ? "bg-destructive/10" : "bg-tone-honey-bg"}`}>
              <XCircle className={`h-5 w-5 ${(loginStats.failed24h || 0) > 5 ? "text-destructive" : "text-tone-honey-fg"}`} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Failed (7d)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{loginStats.failed7d || 0}</p>
            </div>
            <div className="rounded-lg bg-tone-orange-bg p-2.5"><AlertTriangle className="h-5 w-5 text-tone-orange-fg" /></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border">
        <div className="flex gap-2">
          {([["sessions", "Active Sessions", Monitor], ["login-history", "Login History", KeyRound], ["events", "Security Events", ShieldAlert]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          {isSuperAdmin && (
            <button onClick={() => setShowAll(!showAll)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${showAll ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
              <Eye className="h-3.5 w-3.5" /> {showAll ? "All Admins" : "My Only"}
            </button>
          )}
        </div>
      </div>

      {/* Active Sessions Tab */}
      {tab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{activeSessions.length} active session(s)</p>
            <div className="flex gap-2">
              <button onClick={() => loadSessions()} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
              <button onClick={() => revokeAllSessions("self")} className="flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                <Power className="h-3 w-3" /> Sign Out All My Sessions
              </button>
              {isSuperAdmin && showAll && (
                <button onClick={() => revokeAllSessions("all")} className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90">
                  <Ban className="h-3 w-3" /> Revoke All
                </button>
              )}
            </div>
          </div>

          {activeSessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No active sessions</div>
          ) : (
            <div className="grid gap-3">
              {activeSessions.map((s) => (
                <div key={s.id} className={`rounded-xl border p-5 transition ${s.isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2.5 ${s.deviceType === "Mobile" ? "bg-tone-sky-bg" : "bg-tone-emerald-bg"}`}>
                        {s.deviceType === "Mobile" ? <Smartphone className="h-5 w-5 text-tone-sky-fg" /> : <Laptop className="h-5 w-5 text-tone-emerald-fg" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{s.browser || "Unknown"} Â· {s.os || "Unknown"}</p>
                          {s.isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Current</span>}
                        </div>
                        {showAll && s.adminUser && (
                          <p className="text-xs text-muted-foreground">{s.adminUser.firstName} {s.adminUser.lastName} ({s.adminUser.email})</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {s.ipAddress || "â€”"}</span>
                          {s.country && <span>{s.city ? `${s.city}, ` : ""}{s.country}</span>}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {relativeTime(s.lastActivity)}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => revokeSession(s.id)}
                      className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Login History Tab */}
      {tab === "login-history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select value={successFilter} onChange={(e) => { setSuccessFilter(e.target.value); setLoginPage(1); }} className={inputCls + " max-w-[160px]"}>
                <option value="">All Attempts</option>
                <option value="true">Successful</option>
                <option value="false">Failed</option>
              </select>
              <p className="text-xs text-muted-foreground">{loginTotal} total</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Browser / OS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">MFA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loginLogs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No login records</td></tr>
                ) : loginLogs.map((log: any) => (
                  <tr key={log.id} className="bg-card hover:bg-accent/30">
                    <td className="px-4 py-3">
                      {log.adminUser ? (
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.adminUser.firstName} {log.adminUser.lastName}</p>
                          <p className="text-xs text-muted-foreground">{log.email}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{log.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-tone-sage-fg"><CheckCircle2 className="h-3.5 w-3.5" /> Success</span>
                      ) : (
                        <div>
                          <span className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-3.5 w-3.5" /> Failed</span>
                          {log.failReason && <p className="text-[10px] text-muted-foreground mt-0.5">{log.failReason}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{log.ipAddress || "â€”"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.browser || "â€”"} / {log.os || "â€”"}</td>
                    <td className="px-4 py-3">
                      {log.mfaUsed ? (
                        <span className="flex items-center gap-1 text-xs text-primary"><Shield className="h-3 w-3" /> {log.mfaMethod || "Yes"}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-foreground">{relativeTime(log.createdAt)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loginPageCount > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {loginPage} of {loginPageCount}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setLoginPage(loginPage - 1)} disabled={loginPage <= 1} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setLoginPage(loginPage + 1)} disabled={loginPage >= loginPageCount} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Events Tab */}
      {tab === "events" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{securityEvents.length} recent security events</p>
          {securityEvents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Shield className="h-10 w-10 mx-auto text-tone-sage-fg/30 mb-3" />
              <p className="text-sm text-muted-foreground">No security events detected. Your system is clean.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {securityEvents.map((event: any) => {
                const changes = event.changes ? JSON.parse(event.changes) : {};
                const severity = event.entityId;
                const sevColor = severity === "CRITICAL" ? "bg-destructive/10 text-destructive" : severity === "HIGH" ? "bg-tone-orange-bg text-tone-orange-fg" : severity === "MEDIUM" ? "bg-tone-honey-bg text-tone-honey-fg" : "bg-tone-sky-bg text-tone-sky-fg";
                return (
                  <div key={event.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sevColor}`}>{severity}</span>
                        <span className="text-sm font-medium text-foreground">{event.entityType}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{relativeTime(event.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{changes.details || "â€”"}</p>
                    {changes.ip && <p className="text-xs text-muted-foreground mt-1">IP: {changes.ip}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
