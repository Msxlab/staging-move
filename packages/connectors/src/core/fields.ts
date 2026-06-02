/**
 * Per-partner required-fields schema — the typed foundation for the dynamic
 * consent/guided form.
 *
 * Some partners need data we don't already hold to act on a move: a UPS account
 * number, a utility customer number, a policy id. Today the manifest declares
 * these as bare `string[]` keys — enough to know WHAT to ask, not HOW. A
 * `FieldSpec` carries the label, input type, validation, and whether the value
 * is sensitive (so the caller knows to encrypt it at rest + redact it in logs).
 *
 * Pure + side-effect-free: validation is deterministic, no I/O. The web form
 * renders from these specs; the API/guided layer validates against them before
 * storing — one schema, both sides.
 */

export type FieldType = "text" | "number" | "email" | "tel" | "select";

export interface FieldSpec {
  /** Stable key stored on the consent/task, e.g. "accountNumber". */
  key: string;
  /** Human label rendered in the form, e.g. "UPS account number". */
  label: string;
  type: FieldType;
  required: boolean;
  /**
   * When true the value is a secret (account/policy number): the caller must
   * encrypt it at rest and the redacting logger must never print it.
   */
  sensitive?: boolean;
  /** Optional helper text under the field. */
  helpText?: string;
  /** Allowed options for `type: "select"`. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Optional regex (source string) the trimmed value must match. */
  pattern?: string;
  /** Optional max length guard. */
  maxLength?: number;
}

export interface FieldValidationResult {
  ok: boolean;
  /** Field key → human message. Empty when ok. */
  errors: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Validate user-supplied values against a field schema. Deterministic; returns
 * every failing field rather than throwing on the first, so the form can show
 * all errors at once.
 */
export function validateFieldValues(
  specs: readonly FieldSpec[],
  values: Readonly<Record<string, string>>,
): FieldValidationResult {
  const errors: Record<string, string> = {};
  for (const spec of specs) {
    const value = (values[spec.key] ?? "").trim();

    if (!value) {
      if (spec.required) errors[spec.key] = `${spec.label} is required.`;
      continue; // optional + empty → nothing else to check
    }
    if (spec.maxLength && value.length > spec.maxLength) {
      errors[spec.key] = `${spec.label} must be at most ${spec.maxLength} characters.`;
      continue;
    }
    if (spec.type === "email" && !EMAIL_RE.test(value)) {
      errors[spec.key] = `${spec.label} must be a valid email address.`;
      continue;
    }
    if (spec.type === "number" && !NUMBER_RE.test(value)) {
      errors[spec.key] = `${spec.label} must be a number.`;
      continue;
    }
    if (spec.type === "select" && spec.options && !spec.options.some((o) => o.value === value)) {
      errors[spec.key] = `${spec.label} must be one of the allowed options.`;
      continue;
    }
    if (spec.pattern) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(spec.pattern);
      } catch {
        re = null; // a bad pattern is a connector bug, not a user error — skip it
      }
      if (re && !re.test(value)) errors[spec.key] = `${spec.label} is not in the expected format.`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Keys whose values must be encrypted at rest + redacted in logs. */
export function sensitiveFieldKeys(specs: readonly FieldSpec[]): string[] {
  return specs.filter((s) => s.sensitive).map((s) => s.key);
}
