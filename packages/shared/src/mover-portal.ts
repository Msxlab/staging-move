// Mover self-service portal — shared vocabulary + a pure input validator.
// =============================================================================
// Used by BOTH the public web apply form/API and the admin verification queue
// so the two agree on the service list, document kinds, status flow, and what
// counts as a valid submission. The validator is pure + total (no I/O) so the
// API route and unit tests share one source of truth.

import { US_STATES } from "./constants";

// ── Services a moving company can offer ───────────────────────────────────────
export interface MoverServiceOption {
  value: string;
  label: string;
}

export const MOVER_SERVICES: readonly MoverServiceOption[] = [
  { value: "LOCAL", label: "Local moves" },
  { value: "LONG_DISTANCE", label: "Long-distance moves" },
  { value: "INTERSTATE", label: "Interstate moves" },
  { value: "PACKING", label: "Packing & unpacking" },
  { value: "STORAGE", label: "Storage" },
  { value: "SPECIALTY", label: "Specialty items (piano, antiques)" },
  { value: "AUTO_TRANSPORT", label: "Auto transport" },
  { value: "JUNK_REMOVAL", label: "Junk removal" },
] as const;

const MOVER_SERVICE_VALUES = new Set(MOVER_SERVICES.map((s) => s.value));

// ── Proof documents an applicant can upload ──────────────────────────────────
export interface MoverDocumentKindOption {
  value: string;
  label: string;
  /** Recommended at submission (UI hint only; never hard-blocks a submission). */
  recommended: boolean;
}

export const MOVER_DOCUMENT_KINDS: readonly MoverDocumentKindOption[] = [
  { value: "USDOT_CERT", label: "USDOT registration / MC authority", recommended: true },
  { value: "INSURANCE_COI", label: "Certificate of insurance (COI)", recommended: true },
  { value: "STATE_LICENSE", label: "State mover license", recommended: false },
  { value: "BUSINESS_REG", label: "Business registration", recommended: false },
  { value: "OTHER", label: "Other supporting document", recommended: false },
] as const;

const MOVER_DOCUMENT_KIND_VALUES = new Set(MOVER_DOCUMENT_KINDS.map((d) => d.value));

export function isMoverDocumentKind(value: string): boolean {
  return MOVER_DOCUMENT_KIND_VALUES.has(value);
}

// ── Application status flow ───────────────────────────────────────────────────
export const MOVER_APPLICATION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "NEEDS_INFO",
] as const;

export type MoverApplicationStatus = (typeof MOVER_APPLICATION_STATUSES)[number];

/** A decision an admin can take from the review queue (terminal or info-request). */
export const MOVER_DECISION_STATUSES = ["APPROVED", "REJECTED", "NEEDS_INFO"] as const;
export type MoverDecisionStatus = (typeof MOVER_DECISION_STATUSES)[number];

export function isMoverApplicationStatus(value: string): value is MoverApplicationStatus {
  return (MOVER_APPLICATION_STATUSES as readonly string[]).includes(value);
}

/** Plain-English label for a status (admin UI). */
export function moverStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "IN_REVIEW":
      return "In review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "NEEDS_INFO":
      return "Needs info";
    default:
      return status;
  }
}

// ── Upload limits (shared by the web upload route + the apply form UI) ────────
export const MOVER_DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MOVER_DOC_MAX_COUNT = 8; // total documents per application
export const MOVER_DOC_ALLOWED_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export function isAllowedMoverDocContentType(contentType: string): boolean {
  return MOVER_DOC_ALLOWED_CONTENT_TYPES.includes(contentType.split(";")[0]?.trim().toLowerCase() ?? "");
}

// ── Pure input validator ──────────────────────────────────────────────────────

export interface MoverApplicationInput {
  companyLegalName?: unknown;
  dbaName?: unknown;
  usdotNumber?: unknown;
  mcNumber?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  website?: unknown;
  serviceStates?: unknown; // array of 2-letter codes, or comma string
  services?: unknown; // array of service values, or comma string
  fleetSize?: unknown;
  yearsInBusiness?: unknown;
  attestation?: unknown;
}

/** Normalized, storage-ready fields (matches the MoverApplication columns). */
export interface NormalizedMoverApplication {
  companyLegalName: string;
  dbaName: string | null;
  usdotNumber: number;
  mcNumber: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  website: string | null;
  serviceStates: string; // CSV of uppercase 2-letter codes
  services: string; // CSV of service values
  fleetSize: number | null;
  yearsInBusiness: number | null;
  attestation: true;
}

export interface MoverApplicationValidation {
  ok: boolean;
  errors: Record<string, string>;
  value: NormalizedMoverApplication | null;
}

const US_STATE_CODES = new Set<string>(US_STATES.map((s) => s.value));
// Deliberately permissive email shape — the real check is the confirmation
// email landing; we only reject obvious garbage here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toCodeList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const code = trimStr(item).toUpperCase();
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

function toIntOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

/**
 * Validate + normalize a public mover application. Pure & total: returns
 * `{ ok, errors, value }`. `value` is non-null only when `ok` is true. Keep the
 * keys in `errors` aligned with the form field names so the UI can map them.
 */
export function validateMoverApplication(input: MoverApplicationInput): MoverApplicationValidation {
  const errors: Record<string, string> = {};

  const companyLegalName = trimStr(input.companyLegalName);
  if (!companyLegalName) errors.companyLegalName = "Company legal name is required.";
  else if (companyLegalName.length > 255) errors.companyLegalName = "Company legal name is too long.";

  const dbaName = trimStr(input.dbaName);
  if (dbaName.length > 255) errors.dbaName = "DBA name is too long.";

  const usdotNumber = toIntOrNull(input.usdotNumber);
  if (usdotNumber === null || usdotNumber <= 0) errors.usdotNumber = "A valid USDOT number is required.";

  const mcNumber = trimStr(input.mcNumber).replace(/^MC-?/i, "");
  if (mcNumber.length > 20) errors.mcNumber = "MC number is too long.";

  const contactName = trimStr(input.contactName);
  if (!contactName) errors.contactName = "Contact name is required.";
  else if (contactName.length > 120) errors.contactName = "Contact name is too long.";

  const contactEmail = trimStr(input.contactEmail).toLowerCase();
  if (!contactEmail) errors.contactEmail = "Contact email is required.";
  else if (!EMAIL_RE.test(contactEmail) || contactEmail.length > 191)
    errors.contactEmail = "Enter a valid email address.";

  const contactPhone = trimStr(input.contactPhone);
  if (contactPhone.length > 30) errors.contactPhone = "Phone number is too long.";

  let website = trimStr(input.website);
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    if (website.length > 255) errors.website = "Website URL is too long.";
  }

  const serviceStates = toCodeList(input.serviceStates).filter((c) => US_STATE_CODES.has(c));
  if (serviceStates.length === 0) errors.serviceStates = "Select at least one service state.";

  const services = toCodeList(input.services).filter((s) => MOVER_SERVICE_VALUES.has(s));
  if (services.length === 0) errors.services = "Select at least one service offered.";

  const fleetSize = toIntOrNull(input.fleetSize);
  if (fleetSize !== null && (fleetSize < 0 || fleetSize > 100000)) errors.fleetSize = "Enter a valid fleet size.";

  const yearsInBusiness = toIntOrNull(input.yearsInBusiness);
  if (yearsInBusiness !== null && (yearsInBusiness < 0 || yearsInBusiness > 200))
    errors.yearsInBusiness = "Enter a valid number of years.";

  const attestation = input.attestation === true;
  if (!attestation) errors.attestation = "You must attest that the information is accurate.";

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value:
      ok && usdotNumber !== null
        ? {
            companyLegalName,
            dbaName: dbaName || null,
            usdotNumber,
            mcNumber: mcNumber || null,
            contactName,
            contactEmail,
            contactPhone: contactPhone || null,
            website: website || null,
            serviceStates: serviceStates.join(","),
            services: services.join(","),
            fleetSize,
            yearsInBusiness,
            attestation: true,
          }
        : null,
  };
}

/** Human-readable service labels from a stored CSV (admin/email rendering). */
export function moverServiceLabels(csv: string): string[] {
  return csv
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => MOVER_SERVICES.find((s) => s.value === v)?.label ?? v);
}
