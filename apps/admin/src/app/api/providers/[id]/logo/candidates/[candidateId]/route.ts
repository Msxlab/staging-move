import { NextRequest, NextResponse } from "next/server";
import { revalidateProvidersCatalog } from "@/lib/providers-revalidate";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

function parseNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 1000) : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id, candidateId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const notes = parseNotes(body?.notes);

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Action must be approve or reject" },
        { status: 400 },
      );
    }

    const candidate = await prisma.providerLogoCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        providerId: true,
        publicUrl: true,
        source: true,
        sourceUrl: true,
        objectKey: true,
        contentType: true,
        contentHash: true,
        bytes: true,
        status: true,
      },
    });

    if (!candidate || candidate.providerId !== id) {
      return NextResponse.json({ error: "Logo candidate not found" }, { status: 404 });
    }

    if (candidate.status !== "PENDING") {
      return NextResponse.json(
        { error: `Logo candidate is already ${candidate.status.toLowerCase()}` },
        { status: 409 },
      );
    }

    const reviewedAt = new Date();

    if (action === "approve") {
      await prisma.$transaction(async (tx) => {
        await tx.serviceProvider.update({
          where: { id },
          data: { logoUrl: candidate.publicUrl },
        });
        await tx.providerLogoCandidate.update({
          where: { id: candidate.id },
          data: {
            status: "APPROVED",
            reviewedByAdminId: session.adminId,
            reviewedAt,
            notes,
          },
        });
        await tx.providerLogoCandidate.updateMany({
          where: {
            providerId: id,
            status: "PENDING",
            id: { not: candidate.id },
          },
          data: {
            status: "SUPERSEDED",
            reviewedByAdminId: session.adminId,
            reviewedAt,
            notes: "Superseded by approved logo candidate",
          },
        });
        await tx.adminAuditLog.create({
          data: {
            adminUserId: session.adminId,
            action: "LOGO_CAND_APPROVE",
            entityType: "ProviderLogoCandidate",
            entityId: candidate.id,
            changes: JSON.stringify({
              providerId: id,
              source: candidate.source,
              sourceUrl: candidate.sourceUrl,
              objectKey: candidate.objectKey,
              publicUrl: candidate.publicUrl,
              contentType: candidate.contentType,
              contentHash: candidate.contentHash,
              bytes: candidate.bytes,
            }),
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          },
        });
      });

      revalidateProvidersCatalog();

      return NextResponse.json({
        status: "APPROVED",
        logoUrl: candidate.publicUrl,
      });
    }

    await prisma.$transaction([
      prisma.providerLogoCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "REJECTED",
          reviewedByAdminId: session.adminId,
          reviewedAt,
          notes,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "LOGO_CAND_REJECT",
          entityType: "ProviderLogoCandidate",
          entityId: candidate.id,
          changes: JSON.stringify({
            providerId: id,
            source: candidate.source,
            sourceUrl: candidate.sourceUrl,
            objectKey: candidate.objectKey,
            contentType: candidate.contentType,
            contentHash: candidate.contentHash,
            bytes: candidate.bytes,
            notes,
          }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      }),
    ]);

    return NextResponse.json({ status: "REJECTED" });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[ADMIN] logo candidate review failed:", error);
    return NextResponse.json(
      { error: "Failed to review logo candidate" },
      { status: 500 },
    );
  }
}
