import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { buildObjectKey, putObject } from "@/lib/storage/r2-client";
import { sendEmail, renderLocateFlowEmail } from "@/lib/email";
import {
  validateMoverApplication,
  isMoverDocumentKind,
  isAllowedMoverDocContentType,
  moverServiceLabels,
  MOVER_DOC_MAX_BYTES,
  MOVER_DOC_MAX_COUNT,
} from "@locateflow/shared";

// POST /api/movers/apply — public mover self-service application intake.
//
// Accepts multipart/form-data:
//   - application: JSON string of the company fields (validated by the shared
//     validateMoverApplication — single source of truth with the form + tests)
//   - documents:   zero or more proof files (PDF / image), each ≤10MB, ≤8 total
//   - documentKinds: JSON string array of kinds, parallel to `documents`
//
// Gated on MOVER_REGISTRATION_ENABLED (off → 404, the surface doesn't exist).
// Rate-limited per IP. Creates a PENDING MoverApplication + MoverDocument rows
// (files land in R2), then fires a best-effort admin notification email. The
// application is the source of truth — a failed upload or email never rolls it
// back; the admin queue is the review surface.

export const runtime = "nodejs"; // R2 signing + Buffer

const MAX_BODY_BYTES = MOVER_DOC_MAX_COUNT * MOVER_DOC_MAX_BYTES + 256 * 1024; // docs + form slack

/** Pick a safe file extension from the name, falling back to the content type. */
function extFor(fileName: string, contentType: string): string {
  const fromName = /\.([a-zA-Z0-9]{1,6})$/.exec(fileName)?.[1];
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[contentType.split(";")[0]?.trim().toLowerCase() ?? ""] ?? "bin";
}

export async function POST(request: NextRequest) {
  try {
    // Feature gate — the public apply surface only exists when enabled.
    const enabled = (await getRuntimeConfigValue("MOVER_REGISTRATION_ENABLED").catch(() => null))
      ?.trim()
      .toLowerCase();
    if (enabled !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Rate limit: a handful of applications per IP per hour is plenty.
    const rl = await rateLimit(getRateLimitKey(request, "mover-apply"), {
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Upload too large." }, { status: 413 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
    }

    // ── Validate the company fields (shared validator) ──
    let parsedApplication: unknown;
    try {
      parsedApplication = JSON.parse(String(form.get("application") ?? "{}"));
    } catch {
      return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
    }
    const { ok, errors, value } = validateMoverApplication(parsedApplication as Record<string, unknown>);
    if (!ok || !value) {
      return NextResponse.json({ error: "Please fix the highlighted fields.", fields: errors }, { status: 400 });
    }

    // ── Validate the uploaded documents (count / size / type / kind) ──
    const files = form.getAll("documents").filter((f): f is File => f instanceof File);
    let kinds: string[] = [];
    try {
      const raw = form.get("documentKinds");
      kinds = raw ? (JSON.parse(String(raw)) as string[]) : [];
    } catch {
      kinds = [];
    }
    if (files.length > MOVER_DOC_MAX_COUNT) {
      return NextResponse.json({ error: `Attach at most ${MOVER_DOC_MAX_COUNT} documents.` }, { status: 400 });
    }
    for (const file of files) {
      if (file.size > MOVER_DOC_MAX_BYTES) {
        return NextResponse.json({ error: `${file.name} is larger than 10MB.` }, { status: 413 });
      }
      if (!isAllowedMoverDocContentType(file.type)) {
        return NextResponse.json({ error: `${file.name} must be a PDF or image.` }, { status: 415 });
      }
    }

    // ── Create the application (PENDING) ──
    const application = await prisma.moverApplication.create({
      data: { ...value, status: "PENDING" },
      select: { id: true },
    });

    // ── Upload each document to R2, then record it. Best-effort per file: a
    //    failed upload is skipped (never recorded, never rolls back the app). ──
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const kindRaw = typeof kinds[i] === "string" ? kinds[i] : "OTHER";
      const kind = isMoverDocumentKind(kindRaw) ? kindRaw : "OTHER";
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const objectKey = buildObjectKey("document", `mover-${application.id}`, extFor(file.name, file.type));
        await putObject({ objectKey, body: buffer, contentType: file.type });
        await prisma.moverDocument.create({
          data: {
            applicationId: application.id,
            kind,
            fileName: file.name.slice(0, 255) || "document",
            objectKey,
            contentType: file.type.split(";")[0]?.trim().toLowerCase() || "application/octet-stream",
            sizeBytes: file.size,
          },
        });
        uploaded += 1;
      } catch (err) {
        console.error("Mover document upload failed:", err);
      }
    }

    // ── Best-effort admin notification email ──
    void notifyAdmin({
      applicationId: application.id,
      companyLegalName: value.companyLegalName,
      usdotNumber: value.usdotNumber,
      contactEmail: value.contactEmail,
      services: value.services,
      serviceStates: value.serviceStates,
      documentCount: uploaded,
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: application.id, documentsUploaded: uploaded }, { status: 201 });
  } catch (error) {
    console.error("Mover application failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

async function notifyAdmin(input: {
  applicationId: string;
  companyLegalName: string;
  usdotNumber: number;
  contactEmail: string;
  services: string;
  serviceStates: string;
  documentCount: number;
}): Promise<void> {
  const to =
    (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL").catch(() => null))?.trim() ||
    (await getRuntimeConfigValue("SUPPORT_EMAIL").catch(() => null))?.trim() ||
    null;
  if (!to) return; // No ops inbox configured — the admin queue is the source of truth.

  const services = moverServiceLabels(input.services).join(", ") || "—";
  const bodyHtml = `
    <p>A moving company submitted a self-service application for review.</p>
    <ul>
      <li><strong>Company:</strong> ${escapeHtml(input.companyLegalName)}</li>
      <li><strong>USDOT:</strong> ${input.usdotNumber}</li>
      <li><strong>Contact:</strong> ${escapeHtml(input.contactEmail)}</li>
      <li><strong>States:</strong> ${escapeHtml(input.serviceStates)}</li>
      <li><strong>Services:</strong> ${escapeHtml(services)}</li>
      <li><strong>Documents:</strong> ${input.documentCount}</li>
    </ul>
    <p>Review it in the admin verification queue.</p>`;
  const html = renderLocateFlowEmail({
    preheader: `New mover application: ${input.companyLegalName}`,
    title: "New mover application",
    badge: "Verification queue",
    bodyHtml,
  });
  await sendEmail({
    to,
    subject: `New mover application — ${input.companyLegalName} (USDOT ${input.usdotNumber})`,
    html,
    text: `New mover application: ${input.companyLegalName} (USDOT ${input.usdotNumber}). Contact: ${input.contactEmail}. Review it in the admin verification queue.`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
