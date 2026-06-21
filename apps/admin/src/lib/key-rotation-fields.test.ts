import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ENCRYPTED_MODELS } from "./key-rotation-fields";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, "../../../../packages/db/prisma/schema.prisma");

function delegateFor(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Scan schema.prisma for columns that are encrypted *by convention*: a field
 * whose name ends in "Encrypted", is named "mfaSecret", or whose inline comment
 * mentions FIELD_ENCRYPTION_KEY. These are the ones a future contributor is most
 * likely to add — and the ones that silently break the next key rotation if not
 * covered by ENCRYPTED_MODELS. (Unconventionally-named encrypted fields —
 * Service.* and Address.formattedAddress — can't be auto-detected and are
 * pinned by the explicit snapshot test below instead.)
 */
function conventionEncryptedColumns(schema: string): Array<{ delegate: string; field: string }> {
  const out: Array<{ delegate: string; field: string }> = [];
  let currentDelegate: string | null = null;

  for (const rawLine of schema.split("\n")) {
    const line = rawLine.trim();

    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      currentDelegate = delegateFor(modelMatch[1]);
      continue;
    }
    if (line === "}") {
      currentDelegate = null;
      continue;
    }
    if (!currentDelegate) continue;

    // A field line looks like `<name> <Type> ...`; block attributes (@@...) and
    // relation/attribute lines starting with @ won't match the leading \w+ + type.
    const fieldMatch = /^(\w+)\s+\w/.exec(line);
    if (!fieldMatch) continue;
    const field = fieldMatch[1];
    const comment = line.includes("//") ? line.slice(line.indexOf("//")) : "";

    const encryptedByConvention =
      field.endsWith("Encrypted") || field === "mfaSecret" || comment.includes("FIELD_ENCRYPTION_KEY");
    if (encryptedByConvention) out.push({ delegate: currentDelegate, field });
  }

  return out;
}

const covered = new Set(ENCRYPTED_MODELS.flatMap((m) => m.fields.map((f) => `${m.model}.${f}`)));

describe("key-rotation encrypted-field coverage (audit P0-1)", () => {
  it("covers every conventionally-named encrypted column in schema.prisma", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const required = conventionEncryptedColumns(schema);

    // Sanity: the scan must actually find the known encrypted columns, otherwise
    // a parsing regression would make this guard vacuously pass.
    expect(required.length).toBeGreaterThanOrEqual(7);

    const missing = required
      .map((c) => `${c.delegate}.${c.field}`)
      .filter((key) => !covered.has(key));

    // If this fails, a new encrypted column was added to schema.prisma but not to
    // ENCRYPTED_MODELS — rotating the key would make it permanently undecryptable.
    expect(missing).toEqual([]);
  });

  it("matches the explicit expected coverage set (forces deliberate change)", () => {
    expect(ENCRYPTED_MODELS).toEqual([
      { model: "service", idField: "id", fields: ["accountNumber", "username", "phone", "email", "notes"] },
      { model: "address", idField: "id", fields: ["formattedAddress"] },
      { model: "user", idField: "id", fields: ["mfaSecret"] },
      { model: "adminUser", idField: "id", fields: ["mfaSecret"] },
      { model: "runtimeConfigEntry", idField: "id", fields: ["valueEncrypted"] },
      { model: "subscription", idField: "id", fields: ["purchaseTokenEncrypted"] },
      { model: "partnerConsent", idField: "id", fields: ["tokenEncrypted", "refreshTokenEncrypted"] },
      { model: "connectorDispatch", idField: "id", fields: ["confirmationEncrypted", "payloadEncrypted"] },
      { model: "lead", idField: "id", fields: ["payloadEncrypted"] },
    ]);
  });
});
