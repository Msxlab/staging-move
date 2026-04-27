import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  ingestLogoFromWebsite,
  LogoIngestError,
  type LogoIngestFailureStage,
} from "@/lib/logo-ingest";

export const runtime = "nodejs";

interface FailureLogContext {
  providerId: string;
  website: string | null;
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

function logLogoAutoFetchFailure(context: FailureLogContext) {
  console.error("[ADMIN] provider logo auto-fetch failed", {
    providerId: context.providerId,
    website: context.website,
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
 * Try to auto-discover and ingest a logo for the given provider, using its
 * `website` field. Stores the resulting asset as a pending candidate; a
 * separate admin review step publishes it to `ServiceProvider.logoUrl`.
 *
 * Returns 200 with `{ candidate }` on success, 422 with `{ attempted }` when
 * no candidate produced a usable image, 503 when storage isn't configured.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let providerForLog: { providerId: string; website: string | null } = {
    providerId: "unknown",
    website: null,
  };
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id } = await params;
    providerForLog = { providerId: id, website: null };

    const provider = await prisma.serviceProvider.findUnique({
      where: { id },
      select: { id: true, website: true },
    });
    providerForLog = { providerId: id, website: provider?.website ?? null };
    if (!provider) {
      return jsonFailure({
        code: "PROVIDER_NOT_FOUND",
        message: "Provider not found",
        status: 404,
      });
    }
    if (!provider.website) {
      return jsonFailure({
        code: "PROVIDER_WEBSITE_MISSING",
        message: "Provider has no website to discover logo from",
        status: 400,
      });
    }

    const result = await ingestLogoFromWebsite({
      providerId: provider.id,
      website: provider.website,
    });

    if ("failed" in result) {
      const stage = result.failed.attempted.length === 0 ? "parse_logo" : "download_asset";
      logLogoAutoFetchFailure({
        providerId: id,
        website: provider.website,
        stage,
        error: new Error("No logo source returned a usable image"),
        details: result.failed.attempted,
      });
      return jsonFailure({
        code: "LOGO_FETCH_FAILED",
        message: "No logo source returned a usable image",
        details: result.failed.attempted,
        status: 422,
      });
    }

    const existingCandidate = result.sourceUrl
      ? await prisma.providerLogoCandidate
          .findFirst({
            where: {
              providerId: id,
              status: "PENDING",
              OR: [
                { contentHash: result.contentHash },
                { source: result.source, sourceUrl: result.sourceUrl },
              ],
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
          })
      : null;

    if (existingCandidate) {
      return NextResponse.json({
        logoUrl: existingCandidate.publicUrl,
        candidate: existingCandidate,
        source: existingCandidate.source,
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
            source: result.source,
            sourceUrl: result.sourceUrl,
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
      source: result.source,
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
      logLogoAutoFetchFailure({
        providerId: providerForLog.providerId,
        website: providerForLog.website,
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
    logLogoAutoFetchFailure({
      providerId: providerForLog.providerId,
      website: providerForLog.website,
      stage: "create_candidate",
      error,
    });
    return jsonFailure({
      code: "LOGO_AUTO_FETCH_FAILED",
      message: "Failed to auto-fetch logo",
      status: 500,
    });
  }
}
