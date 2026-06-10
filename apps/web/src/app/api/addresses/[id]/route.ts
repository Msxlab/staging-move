import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { addressSchema } from "@/lib/validators";
import { geocodeFallbackForPersist } from "@/lib/census-geocoder";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { syncMoveTasksForAddress } from "@/lib/move-task-sync";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { decryptServiceSensitiveFields } from "@/lib/service-sensitive-fields";
import { enrichServicesWithProviderCatalog } from "@/lib/service-provider-logo-enrichment";
import { redactServices } from "@/lib/service-visibility";
import { enqueueAddressChange } from "@/lib/connector-runtime";
import { isApiConnectorsEnabled, userHasApiConnectorEntitlement } from "@/lib/connector-oauth";
import {
  assertScopedRecordAction,
  resolveWorkspaceDataScope,
  scopedRecordWhere,
} from "@/lib/workspace-data-scope";

// GET /api/addresses/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;
    const address = await prisma.address.findUnique({
      where: { id },
      include: {
        services: {
          where: activeTrackedServiceWhereForScope(
            { userId, workspaceId: scope.workspaceId },
            scope.memberRole === "CHILD" ? { userId } : {},
          ),
          include: {
            provider: { select: { id: true, name: true, logoUrl: true, website: true } },
            customProvider: { select: { id: true, name: true, category: true, website: true, phone: true, email: true, providerType: true, trustStatus: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        // Budgets are financial data. A CHILD has zero financial visibility, so
        // they never receive any; everyone else only sees budgets within their
        // resolved scope (the shared workspace budget, or their own legacy rows).
        // Without this filter a CHILD could read the owner's budget off their
        // own (shared) address — see the address-detail financial-leak fix.
        budgets:
          scope.memberRole === "CHILD"
            ? { where: { id: { in: [] } } }
            : {
                where: scope.workspaceId
                  ? { workspaceId: scope.workspaceId, deletedAt: null }
                  : { userId, deletedAt: null },
              },
      },
    });

    if (!address || address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    assertScopedRecordAction(address, scope, "address.view", { notFoundMessage: "Address not found" });

    // Decrypt sensitive fields, then redact those the caller's role may not see
    // (service.viewSensitive — AUTH-015). Each member's own services and the
    // workspace owner keep full visibility; basic fields are always returned.
    const services = redactServices(
      await enrichServicesWithProviderCatalog(
        address.services.map((service: any) => decryptServiceSensitiveFields(service)),
      ),
      scope,
    );

    return NextResponse.json({
      address: {
        ...address,
        services,
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
    });
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to fetch address:", error);
    return NextResponse.json({ error: "Failed to fetch address" }, { status: 500 });
  }
}

// PATCH /api/addresses/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    assertScopedRecordAction(existing, scope, "address.edit", {
      notFoundMessage: "Address not found",
      forbiddenMessage: "No permission to edit this address.",
    });

    const body = await request.json();
    const validated = addressSchema.partial().parse(body);

    // Server-side geocode fallback for manually-typed edits: when the location
    // fields change and the RESULTING record would have null coordinates
    // (payload cleared them, or they were already null), try to geocode the
    // post-update address. Best-effort + fail-open (no_match/error/timeout →
    // persist nulls exactly as before, no user-facing error, 2.5s cap) and the
    // helper never overwrites user/Places-provided coordinates.
    let geocoded: { latitude: number; longitude: number } | null = null;
    const locationFieldChanged = (["street", "city", "state", "zip"] as const).some(
      (k) => validated[k] !== undefined && validated[k] !== existing[k],
    );
    if (locationFieldChanged) {
      geocoded = await geocodeFallbackForPersist({
        street: validated.street ?? existing.street,
        city: validated.city ?? existing.city,
        state: validated.state ?? existing.state,
        zip: validated.zip ?? existing.zip,
        latitude: validated.latitude !== undefined ? validated.latitude : existing.latitude,
        longitude: validated.longitude !== undefined ? validated.longitude : existing.longitude,
      });
    }

    const updateData = {
      ...validated,
      ...(geocoded ?? {}),
      ...(validated.formattedAddress !== undefined && {
        formattedAddress: validated.formattedAddress ? encrypt(validated.formattedAddress) : validated.formattedAddress,
      }),
      startDate: validated.startDate ? new Date(validated.startDate) : undefined,
      endDate: validated.endDate ? new Date(validated.endDate) : undefined,
    };

    // Demote other primaries + set this one in ONE transaction so a failed
    // update can't leave the user with zero primary addresses (the unset
    // already ran). Mirrors the POST create path, which is transactional for
    // the same reason.
    const address = await prisma.$transaction(async (tx) => {
      if (validated.isPrimary) {
        // Demote only the ACTOR's own primaries (per-user primary) — never flip
        // another member's or the owner's primary across the shared workspace.
        await tx.address.updateMany({
          where: {
            userId: scope.actorUserId,
            ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
            isPrimary: true,
            id: { not: id },
          },
          data: { isPrimary: false },
        });
      }
      return tx.address.update({ where: { id }, data: updateData });
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "UPDATE", entityType: "Address", entityId: id, changes: validated, ...meta });

    const moveTaskSync = await syncMoveTasksForAddress(userId, id, { workspaceId: scope.workspaceId });

    // Auto-sync to connected partners when the user's PRIMARY address location
    // changes (or an address becomes primary). Best-effort + gated; a no-op
    // unless the user has connected a partner (enqueue finds no consents).
    try {
      const locationKeys = ["street", "street2", "city", "state", "zip", "country"] as const;
      const locationChanged = locationKeys.some(
        (k) => (validated as any)[k] !== undefined && (validated as any)[k] !== (existing as any)[k],
      );
      const becamePrimary = validated.isPrimary === true && !existing.isPrimary;
      // Gate the auto-sync on the SAME annual-Pro entitlement the explicit
      // dispatch entry points check — a downgraded user with a lingering
      // consent must not get address edits auto-enqueued (P1, was flag-only).
      if (
        address.isPrimary &&
        existing.userId === userId &&
        (locationChanged || becamePrimary) &&
        (await isApiConnectorsEnabled()) &&
        (await userHasApiConnectorEntitlement(scope.workspaceId ? scope.ownerUserId : userId))
      ) {
        await enqueueAddressChange({ userId, toAddressId: id, workspaceId: scope.workspaceId });
      }
    } catch {
      // best-effort: a sync enqueue must never fail the address update
    }

    return NextResponse.json({
      address: {
        ...address,
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
      moveTaskSync,
    });
  } catch (error: any) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    console.error("Failed to update address:", error);
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

// DELETE /api/addresses/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    assertScopedRecordAction(existing, scope, "address.delete", {
      notFoundMessage: "Address not found",
      forbiddenMessage: "No permission to delete this address.",
    });

    // If the address being removed is the user's PRIMARY, line up the most
    // recent remaining address to inherit primary status in the same
    // transaction. provider detail, /api/providers/compare and connector
    // dispatch all read the primary address directly with NO fallback, so
    // leaving the user with addresses-but-no-primary silently degrades those
    // surfaces. Resolved before the tx (read-only); the user is acting on
    // their own addresses single-threaded, so there is no meaningful race.
    let promotedPrimaryId: string | null = null;
    if (existing.isPrimary) {
      const nextPrimary = await prisma.address.findFirst({
        where: scopedRecordWhere(scope, { deletedAt: null, id: { not: id } }),
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      promotedPrimaryId = nextPrimary?.id ?? null;
    }

    // Cascade the soft-delete to the address's services AND budgets in one
    // transaction. The schema's onDelete: SetNull never fires for our soft
    // deletes, so without this the services keep isActive=true and the budgets
    // keep deletedAt=null, both surfacing in their list endpoints while
    // pointing at an address the user just removed.
    const now = new Date();
    const ops = [
      prisma.service.updateMany({
        where: scopedRecordWhere(scope, { addressId: id, deletedAt: null }),
        data: { isActive: false, deactivatedAt: now, deletedAt: now },
      }),
      prisma.budget.updateMany({
        where: scopedRecordWhere(scope, { addressId: id, deletedAt: null }),
        data: { deletedAt: now },
      }),
      prisma.address.update({ where: { id }, data: { deletedAt: now } }),
    ];
    if (promotedPrimaryId) {
      ops.push(
        prisma.address.update({
          where: { id: promotedPrimaryId },
          data: { isPrimary: true },
        }),
      );
    }
    const txResults = await prisma.$transaction(ops);
    const servicesResult = txResults[0] as { count: number };
    const budgetsResult = txResults[1] as { count: number };

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "Address",
      entityId: id,
      changes: {
        nickname: existing.nickname,
        servicesDeactivated: servicesResult.count,
        budgetsDeleted: budgetsResult.count,
        ...(promotedPrimaryId ? { promotedPrimaryId } : {}),
      },
      ...meta,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    console.error("Failed to delete address:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
