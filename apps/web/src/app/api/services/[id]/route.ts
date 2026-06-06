import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createUserAuthDiagnostics,
  expireUserSessionCookies,
  requireDbUserId,
  requireVerifiedUser,
  type UserAuthDiagnostics,
} from "@/lib/auth";
import { serviceSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { safeSyncMoveTasksForAddress } from "@/lib/move-task-sync";
import {
  decryptServiceSensitiveFields,
  encryptServiceSensitiveFields,
} from "@/lib/service-sensitive-fields";
import {
  duplicateServiceError,
  findDuplicateTrackedService,
} from "@/lib/service-duplicate-guard";
import { enrichServicesWithProviderCatalog } from "@/lib/service-provider-logo-enrichment";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  assertScopedRecordAction,
  resolveWorkspaceDataScope,
} from "@/lib/workspace-data-scope";

const VERIFY_EMAIL_REDIRECT = "/verify-email?redirect=%2Fservices";

function serviceError(code: string, error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

function logServiceAuthDiagnostic(
  method: string,
  diagnostics: UserAuthDiagnostics | undefined,
  failureCode: string,
) {
  console.warn("service_auth_diagnostic", {
    layer: "route",
    route: "/api/services/[id]",
    method,
    cookieCandidatesCount: diagnostics?.cookieCandidatesCount ?? null,
    jwtCandidateValidCount: diagnostics?.jwtCandidateValidCount ?? null,
    dbSessionFound: diagnostics?.dbSessionFound ?? null,
    sessionExpired: diagnostics?.sessionExpired ?? null,
    fingerprintMatched: diagnostics?.fingerprintMatched ?? null,
    jwtUserMatchesSession: diagnostics?.jwtUserMatchesSession ?? null,
    jwtUserFound: diagnostics?.jwtUserFound ?? null,
    sessionUserFound: diagnostics?.sessionUserFound ?? null,
    dbUserFound: diagnostics?.dbUserFound ?? null,
    canonicalUserFound: diagnostics?.canonicalUserFound ?? null,
    canonicalUserDeleted: diagnostics?.canonicalUserDeleted ?? null,
    userLookupClient: diagnostics?.userLookupClient ?? null,
    emailVerified: diagnostics?.emailVerified ?? null,
    finalFailureCode: diagnostics?.finalFailureCode ?? failureCode,
  });
}

function authErrorResponse(
  error: unknown,
  diagnostics?: UserAuthDiagnostics,
  method = "UNKNOWN",
  request?: NextRequest,
) {
  if (!(error instanceof Error)) return null;
  if (error.message === "UNAUTHORIZED") {
    const failureCode = diagnostics?.finalFailureCode ?? "UNAUTHORIZED";
    logServiceAuthDiagnostic(method, diagnostics, "UNAUTHORIZED");
    const response = serviceError("UNAUTHORIZED", "Please sign in again.", 401);
    response.headers.set("X-LocateFlow-Auth-Layer", "route");
    response.headers.set("X-LocateFlow-Auth-Failure", failureCode);
    // Multi-domain cookie expiry so a legacy/dead session row (isActive=false)
    // does not keep the same cookie alive across retries — the next request
    // arrives without user_session and the client redirects to sign-in.
    const host = request?.headers.get("host");
    return expireUserSessionCookies(response, host);
  }
  if (error.message === "EMAIL_VERIFICATION_REQUIRED") {
    logServiceAuthDiagnostic(method, diagnostics, "EMAIL_VERIFICATION_REQUIRED");
    const response = serviceError(
      "EMAIL_VERIFICATION_REQUIRED",
      "Please verify your email to manage services.",
      403,
      { redirectTo: VERIFY_EMAIL_REDIRECT },
    );
    response.headers.set("X-LocateFlow-Auth-Layer", "route");
    response.headers.set("X-LocateFlow-Auth-Failure", "EMAIL_VERIFICATION_REQUIRED");
    return response;
  }
  return null;
}

// GET /api/services/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authDiagnostics = createUserAuthDiagnostics();
  try {
    const userId = await requireDbUserId({ diagnostics: authDiagnostics });
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        address: true,
        reminders: true,
        provider: { select: { id: true, name: true, slug: true, website: true, phone: true, logoUrl: true, scope: true } },
        customProvider: { select: { id: true, name: true, category: true, phone: true, website: true, email: true, providerType: true, trustStatus: true } },
      },
    });

    if (!service || service.deletedAt) {
      return serviceError("NOT_FOUND", "Service not found.", 404);
    }
    assertScopedRecordAction(service, scope, "service.viewBasic", {
      notFoundMessage: "Service not found.",
      forbiddenMessage: "No permission to view this service.",
    });

    // Decrypt sensitive fields
    const [decrypted] = await enrichServicesWithProviderCatalog([
      decryptServiceSensitiveFields(service as any),
    ]);

    return NextResponse.json({ service: decrypted });
  } catch (error) {
    const authResponse = authErrorResponse(error, authDiagnostics, "GET", request);
    if (authResponse) return authResponse;
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}

// PATCH /api/services/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authDiagnostics = createUserAuthDiagnostics();
  try {
    const userId = await requireVerifiedUser({ diagnostics: authDiagnostics });
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return serviceError("NOT_FOUND", "Service not found.", 404);
    }
    assertScopedRecordAction(existing, scope, "service.edit", {
      notFoundMessage: "Service not found.",
      forbiddenMessage: "No permission to edit this service.",
    });

    const body = await request.json();
    const validated = serviceSchema.partial().parse(body);
    const normalizedCategory =
      validated.category !== undefined
        ? validated.category.trim().toUpperCase()
        : existing.category;

    if (validated.providerId && validated.customProviderId) {
      return NextResponse.json({ error: "Choose either a listed provider or a custom provider, not both" }, { status: 400 });
    }

    if (validated.addressId) {
      const address = await prisma.address.findUnique({ where: { id: validated.addressId } });
      if (!address || address.deletedAt) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      if (scope.workspaceId ? address.workspaceId !== scope.workspaceId : address.userId !== userId) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
    }

    if (validated.providerId) {
      const provider = await prisma.serviceProvider.findUnique({ where: { id: validated.providerId } });
      if (!provider || provider.deletedAt) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      }
    }

    if (validated.customProviderId) {
      const customProvider = await prisma.userCustomProvider.findFirst({
        where: { id: validated.customProviderId, userId, deletedAt: null },
      });
      if (!customProvider) {
        return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
      }
    }

    const duplicate = await findDuplicateTrackedService(prisma, {
      userId,
      workspaceId: scope.workspaceId,
      addressId: validated.addressId || existing.addressId,
      category: normalizedCategory,
      providerName: validated.providerName || existing.providerName,
      providerId: validated.providerId ?? existing.providerId,
      customProviderId: validated.customProviderId ?? existing.customProviderId,
      ignoreServiceId: existing.id,
    });
    if (duplicate) {
      return NextResponse.json(duplicateServiceError(duplicate), { status: 409 });
    }

    // Encrypt sensitive fields if provided
    const encryptedData = encryptServiceSensitiveFields({
      ...validated,
      ...(validated.category !== undefined && { category: normalizedCategory }),
    });

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...encryptedData,
        // Keep the listed-vs-custom provider link mutually exclusive: switching
        // a service to one kind clears the other, so a PATCH that sends only
        // the new id can't leave the row pointing at BOTH a listed and a custom
        // provider. (The both-in-one-request case is already 400'd above.)
        ...(validated.providerId ? { customProviderId: null } : {}),
        ...(validated.customProviderId ? { providerId: null } : {}),
        contractEndDate: validated.contractEndDate ? new Date(validated.contractEndDate) : undefined,
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "UPDATE", entityType: "Service", entityId: id, changes: validated, ...meta });

    const addressIdsToSync = [
      existing.addressId,
      validated.addressId,
    ].filter((value): value is string => Boolean(value));
    const moveTaskSync =
      addressIdsToSync.length > 0
        ? await Promise.all(
            [...new Set(addressIdsToSync)].map((addressId) =>
              safeSyncMoveTasksForAddress(userId, addressId, { workspaceId: scope.workspaceId }),
            ),
          )
        : [];

    return NextResponse.json({ service: decryptServiceSensitiveFields(service as any), moveTaskSync });
  } catch (error: any) {
    const authResponse = authErrorResponse(error, authDiagnostics, "PATCH", request);
    if (authResponse) return authResponse;
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error?.code === "P2025") {
      return serviceError("NOT_FOUND", "Service not found.", 404);
    }
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE /api/services/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authDiagnostics = createUserAuthDiagnostics();
  try {
    const userId = await requireVerifiedUser({ diagnostics: authDiagnostics });
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return serviceError("NOT_FOUND", "Service not found.", 404);
    }
    assertScopedRecordAction(existing, scope, "service.delete", {
      notFoundMessage: "Service not found.",
      forbiddenMessage: "No permission to delete this service.",
    });

    const now = new Date();
    await prisma.service.update({ where: { id }, data: { deletedAt: now, isActive: false, deactivatedAt: now } });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "DELETE", entityType: "Service", entityId: id, changes: { provider: existing.providerName }, ...meta });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = authErrorResponse(error, authDiagnostics, "DELETE", request);
    if (authResponse) return authResponse;
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.code === "P2025") {
      return serviceError("NOT_FOUND", "Service not found.", 404);
    }
    console.error("Failed to delete service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
