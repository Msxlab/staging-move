"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import {
  MOVER_SERVICES,
  MOVER_DOCUMENT_KINDS,
  MOVER_DOC_MAX_BYTES,
  US_STATES,
} from "@locateflow/shared";

/**
 * Public mover self-service application form. Collects the company profile +
 * (optional) proof documents and POSTs multipart/form-data to /api/movers/apply.
 * The shared validateMoverApplication runs server-side; this form mirrors the
 * required-field hints and surfaces the per-field errors the API returns.
 */

type FieldErrors = Record<string, string>;

// The recommended proof documents (one labeled file input each). OTHER is
// omitted from the form for simplicity — these four cover the review needs.
const DOC_INPUTS = MOVER_DOCUMENT_KINDS.filter((d) => d.value !== "OTHER");

export function MoverApplyForm() {
  const [companyLegalName, setCompanyLegalName] = useState("");
  const [dbaName, setDbaName] = useState("");
  const [usdotNumber, setUsdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [serviceStates, setServiceStates] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [fleetSize, setFleetSize] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [attestation, setAttestation] = useState(false);
  const [docs, setDocs] = useState<Record<string, File | null>>({});

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const sortedStates = useMemo(() => [...US_STATES].sort((a, b) => a.label.localeCompare(b.label)), []);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg(null);
    setFieldErrors({});

    const application = {
      companyLegalName,
      dbaName,
      usdotNumber,
      mcNumber,
      contactName,
      contactEmail,
      contactPhone,
      website,
      serviceStates,
      services,
      fleetSize,
      yearsInBusiness,
      attestation,
    };

    const form = new FormData();
    form.append("application", JSON.stringify(application));
    const kinds: string[] = [];
    for (const { value } of DOC_INPUTS) {
      const file = docs[value];
      if (file) {
        form.append("documents", file);
        kinds.push(value);
      }
    }
    form.append("documentKinds", JSON.stringify(kinds));

    try {
      const res = await fetch("/api/movers/apply", { method: "POST", body: form });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (payload?.fields) setFieldErrors(payload.fields as FieldErrors);
        throw new Error(payload?.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message);
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-tone-sage-fg" aria-hidden="true" />
        <h2 className="h2 mt-4 text-2xl text-foreground">Application received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — our team will verify your USDOT registration and licensing, then email{" "}
          <span className="font-medium text-foreground">{contactEmail || "you"}</span> with next steps.
          Verification is typically completed within a few business days.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
  const labelClass = "block text-sm font-medium text-foreground mb-1.5";
  const errClass = "mt-1 text-xs text-tone-rose-fg";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMsg && (
        <div role="alert" className="rounded-xl border border-tone-rose-br bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">
          {errorMsg}
        </div>
      )}

      {/* Company */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</legend>
        <div>
          <label className={labelClass} htmlFor="companyLegalName">Legal company name *</label>
          <input id="companyLegalName" className={inputClass} value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} required maxLength={255} />
          {fieldErrors.companyLegalName && <p className={errClass}>{fieldErrors.companyLegalName}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor="dbaName">DBA / trade name</label>
          <input id="dbaName" className={inputClass} value={dbaName} onChange={(e) => setDbaName(e.target.value)} maxLength={255} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="usdotNumber">USDOT number *</label>
            <input id="usdotNumber" className={inputClass} inputMode="numeric" value={usdotNumber} onChange={(e) => setUsdotNumber(e.target.value)} required />
            {fieldErrors.usdotNumber && <p className={errClass}>{fieldErrors.usdotNumber}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="mcNumber">MC number</label>
            <input id="mcNumber" className={inputClass} value={mcNumber} onChange={(e) => setMcNumber(e.target.value)} placeholder="MC-123456" />
          </div>
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="contactName">Contact name *</label>
            <input id="contactName" className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} required maxLength={120} />
            {fieldErrors.contactName && <p className={errClass}>{fieldErrors.contactName}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="contactEmail">Contact email *</label>
            <input id="contactEmail" type="email" className={inputClass} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            {fieldErrors.contactEmail && <p className={errClass}>{fieldErrors.contactEmail}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="contactPhone">Phone</label>
            <input id="contactPhone" className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="website">Website</label>
            <input id="website" className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
            {fieldErrors.website && <p className={errClass}>{fieldErrors.website}</p>}
          </div>
        </div>
      </fieldset>

      {/* Services + coverage */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services & coverage</legend>
        <div>
          <span className={labelClass}>Services offered *</span>
          <div className="flex flex-wrap gap-2">
            {MOVER_SERVICES.map((s) => {
              const on = services.includes(s.value);
              return (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setServices((cur) => toggle(cur, s.value))}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {fieldErrors.services && <p className={errClass}>{fieldErrors.services}</p>}
        </div>
        <div>
          <span className={labelClass}>Service states *</span>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">
            {sortedStates.map((st) => {
              const on = serviceStates.includes(st.value);
              return (
                <button
                  type="button"
                  key={st.value}
                  onClick={() => setServiceStates((cur) => toggle(cur, st.value))}
                  aria-pressed={on}
                  title={st.label}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {st.value}
                </button>
              );
            })}
          </div>
          {fieldErrors.serviceStates && <p className={errClass}>{fieldErrors.serviceStates}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="fleetSize">Fleet size</label>
            <input id="fleetSize" className={inputClass} inputMode="numeric" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="yearsInBusiness">Years in business</label>
            <input id="yearsInBusiness" className={inputClass} inputMode="numeric" value={yearsInBusiness} onChange={(e) => setYearsInBusiness(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Documents */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Proof documents (PDF or image, up to {Math.round(MOVER_DOC_MAX_BYTES / (1024 * 1024))}MB each)
        </legend>
        {DOC_INPUTS.map((d) => (
          <div key={d.value} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{d.label}{d.recommended ? " *" : ""}</p>
              {docs[d.value] && <p className="truncate text-xs text-muted-foreground">{docs[d.value]?.name}</p>}
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/5">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {docs[d.value] ? "Change" : "Upload"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => setDocs((cur) => ({ ...cur, [d.value]: e.target.files?.[0] ?? null }))}
              />
            </label>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Documents are optional to submit, but speed up verification. Items marked * are recommended.</p>
      </fieldset>

      {/* Attestation */}
      <label className="flex items-start gap-3 rounded-xl border border-border bg-foreground/5 px-4 py-3">
        <input type="checkbox" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span className="text-sm text-foreground">
          I attest that the information above is accurate and that I am authorized to represent this company.
        </span>
      </label>
      {fieldErrors.attestation && <p className={errClass}>{fieldErrors.attestation}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === "submitting" ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
