import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  ingestLogoFromUpload,
  LogoIngestError,
  type LogoIngestFailureStage,
} from "@/lib/logo-ingest";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 1_000_000;

interface FailureLogContext {
  providerId: string;
  stage: LogoIngestFailureStage;
  error: unknown;
  details?: unknown;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logLogoUploadFailure(context: FailureLogContext) {
  console.error("[ADMIN] provider logo upload failed", {
    providerId: context.providerId,
    stage: context.stage,
    errorName: errorName(context.error),
    errorMessage: errorMessage(context.error).slice(0, 500),
    details: context.details,
  });
}

function jsonFailure(input: {
  code: string;
  message: string;
  details?: unknown;
  status: number;
}) {
  return NextResponse.json(
    {
      error: input.code,
      message: input.message,
      details: input.details ?? null,
    },
    { status: input.status },
  );
}

/**
 * Manual logo upload (multipart/form-data, single field "file"). Used when
 * the auto-fetch endpoint can't find a usable logo or when ops have a
 * specific brand asset to use. Uploads are still stored as reviewable
 * candidates so the publish step is audited and reversible.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let providerIdForLog = "unknown";
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id } = await params;
    providerIdForLog = id;

    const provider = await prisma.serviceProvider.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!provider) {
      return jsonFailure({
        code: "PROVIDER_NOT_FOUND",
        message: "Provider not found",
        status: 404,
      });
    }

    let file: File | null = null;
    try {
      const formData = await request.formData();
      const value = formData.get("file");
      if (value instanceof File) file = value;
    } catch (error) {
      logLogoUploadFailure({
        providerId: id,
        stage: "parse_multipart",
        error,
      });
      return jsonFailure({
        code: "INVALID_LOGO_FILE",
        message: "Invalid multipart body",
        status: 400,
      });
    }
    if (!file) {
      const error = new Error("Missing 'file' field");
      logLogoUploadFailure({
        providerId: id,
        stage: "validate_request",
        error,
      });
      return jsonFailure({
        code: "INVALID_LOGO_FILE",
        message: "Missing 'file' field",
        status: 400,
      });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const error = new Error("File too large");
      logLogoUploadFailure({
        providerId: id,
        stage: "validate_request",
        error,
        details: { size: file.size, max: MAX_UPLOAD_BYTES },
      });
      return jsonFailure({
        code: "INVALID_LOGO_FILE",
        message: `File too large (max ${MAX_UPLOAD_BYTES} bytes)`,
        status: 413,
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "application/octet-stream";

    const result = await ingestLogoFromUpload({
      providerId: provider.id,
      body: buffer,
      contentType,
    });

    const existingCandidate = await prisma.providerLogoCandidate
      .findFirst({
        where: {
          providerId: id,
          status: "PENDING",
          contentHash: result.contentHash,
        },
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          publicUrl: true,
          contentType: true,
          contentHash: true,
          bytes: true,
          status: true,
          createdAt: true,
        },
      })
      .catch((error) => {
        throw new LogoIngestError({
          code: "CANDIDATE_CREATE_FAILED",
          message: "Failed to check existing logo candidates",
          stage: "create_candidate",
          status: 500,
          details: errorMessage(error).slice(0, 500),
        });
      });

    if (existingCandidate) {
      return NextResponse.json({
        logoUrl: existingCandidate.publicUrl,
        candidate: existingCandidate,
        contentType: existingCandidate.contentType,
        bytes: existingCandidate.bytes,
        status: "PENDING",
        duplicate: true,
      });
    }

    const candidate = await prisma.providerLogoCandidate
      .create({
        data: {
          providerId: id,
          source: result.source,
          sourceUrl: result.sourceUrl,
          publicUrl: result.publicUrl,
          objectKey: result.objectKey,
          contentType: result.contentType,
          contentHash: result.contentHash,
          bytes: result.bytes,
          status: "PENDING",
          createdByAdminId: session.adminId,
        },
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          publicUrl: true,
          contentType: true,
          contentHash: true,
          bytes: true,
          status: true,
          createdAt: true,
        },
      })
      .catch((error) => {
        throw new LogoIngestError({
          code: "CANDIDATE_CREATE_FAILED",
          message: "Failed to create logo candidate",
          stage: "create_candidate",
          status: 500,
          details: errorMessage(error).slice(0, 500),
        });
      });

    await prisma.adminAuditLog
      .create({
        data: {
          adminUserId: session.adminId,
          action: "LOGO_CAND_ADD",
          entityType: "ProviderLogoCandidate",
          entityId: candidate.id,
          changes: JSON.stringify({
            providerId: id,
            source: "manual-upload",
            objectKey: result.objectKey,
            bytes: result.bytes,
            contentType: result.contentType,
            contentHash: result.contentHash,
          }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      })
      .catch((error) => {
        throw new LogoIngestError({
          code: "AUDIT_LOG_FAILED",
          message: "Logo candidate was created but audit logging failed",
          stage: "audit_log",
          status: 500,
          details: errorMessage(error).slice(0, 500),
        });
      });

    return NextResponse.json({
      logoUrl: result.publicUrl,
      candidate,
      contentType: result.contentType,
      bytes: result.bytes,
      status: "PENDING",
    });
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof LogoIngestError) {
      logLogoUploadFailure({
        providerId: providerIdForLog,
        stage: error.stage,
        error,
        details: error.details,
      });
      return jsonFailure({
        code: error.code,
        message: error.message,
        details: error.details,
        status: error.status,
      });
    }
    logLogoUploadFailure({
      providerId: providerIdForLog,
      stage: "validate_request",
      error,
    });
    return jsonFailure({
      code: "LOGO_UPLOAD_FAILED",
      message: "Failed to upload logo",
      status: 500,
    });
  }
}
