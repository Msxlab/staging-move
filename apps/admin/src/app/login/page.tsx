"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuroraBackground } from "@/components/aurora";
import "../aurora.css";

export default function LoginPage() {
  const tLogin = useTranslations("login");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // MFA step state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const mfaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mfaRequired && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [mfaRequired, useBackupCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, string> = { email, password };
      if (useBackupCode && backupCode.trim()) {
        body.backupCode = backupCode.trim();
      } else if (!useBackupCode && mfaCode.trim()) {
        body.mfaCode = mfaCode.trim();
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 403 && data.requiresMfa) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || tLogin("invalid"));
        if (mfaRequired) {
          setMfaCode("");
          setBackupCode("");
        }
        setLoading(false);
        return;
      }

      toast.success(`${tLogin("title")} - ${data.admin.firstName}`);
      window.location.assign("/");
    } catch {
      toast.error(tLogin("invalid"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "mt-1 block w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="adm-aurora relative flex min-h-screen items-center justify-center bg-background">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md space-y-8 rounded-3xl border border-border/70 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Admin command
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            {mfaRequired ? tCommon("confirm") : tLogin("title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mfaRequired ? tLogin("mfaRequired") : tLogin("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!mfaRequired ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">{tLogin("email")}</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="admin@locateflow.com" autoComplete="email" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">{tLogin("password")}</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} placeholder="........" autoComplete="current-password" />
              </div>
              {!useBackupCode ? (
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-foreground">{tLogin("mfaCode")}</label>
                  <input
                    ref={mfaInputRef}
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={inputCls + " text-center text-lg font-mono"}
                    placeholder="000000"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="backupCode" className="block text-sm font-medium text-foreground">{tLogin("backupCode")}</label>
                  <input
                    ref={mfaInputRef}
                    id="backupCode"
                    type="text"
                    autoComplete="off"
                    maxLength={16}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 16))}
                    className={inputCls + " text-center text-lg tracking-widest font-mono"}
                    placeholder="XXXXXXXX"
                  />
                </div>
              )}
              <button type="button" onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(""); setBackupCode(""); }}
                className="text-xs text-primary hover:underline">
                {tLogin("useBackupCode")}
              </button>
            </>
          ) : (
            <>
              {!useBackupCode ? (
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-foreground">{tLogin("mfaCode")}</label>
                  <input
                    ref={mfaInputRef}
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    className={inputCls + " text-center text-2xl tracking-[0.5em] font-mono"}
                    placeholder="000000"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="backupCode" className="block text-sm font-medium text-foreground">{tLogin("backupCode")}</label>
                  <input
                    ref={mfaInputRef}
                    id="backupCode"
                    type="text"
                    autoComplete="off"
                    maxLength={8}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 8))}
                    required
                    className={inputCls + " text-center text-lg tracking-widest font-mono"}
                    placeholder="XXXXXXXX"
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(""); setBackupCode(""); }}
                  className="text-primary hover:underline">
                  {tLogin("useBackupCode")}
                </button>
                <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(""); setBackupCode(""); setUseBackupCode(false); }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3 w-3" /> {tCommon("back")}
                </button>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? tCommon("loading") : mfaRequired ? tCommon("confirm") : tLogin("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
