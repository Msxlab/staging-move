import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { lookupVehicleByVin, type VehicleLookupResult } from "@/lib/nhtsa";

// GET /api/vehicles/decode?vin=2HKRW2H59KH601234 — the move checklist's
// "Check your vehicle" helper (vehicle-registration task).
//
// Decodes the VIN via NHTSA vPIC and looks up open recall campaigns via the
// NHTSA recalls API (both keyless — see apps/web/src/lib/nhtsa.ts). The lib
// degrades gracefully (status unions, never throws), so an authorized,
// well-formed request always answers 200 — the `vehicle`/`recalls` blocks
// individually report "no_match" / "error" / "unavailable" instead of failing
// the request.
//
//   • auth required (401 via the standard api-gate shape),
//   • zod VIN validation: exactly 17 chars, letters I/O/Q never occur (400),
//   • per-user rate limit (NHTSA is a shared public resource),
//   • response contract: { vehicle, recalls } — nothing else (no lib
//     reason/source internals leak to the client).

// 17 characters; I, O, and Q are never used in a VIN (ISO 3779). Case is
// normalized server-side, so lowercase input is accepted.
const vinSchema = z.object({
  vin: z
    .string()
    .trim()
    .regex(/^[a-hj-npr-z0-9]{17}$/i, "INVALID_VIN"),
});

interface VehicleSection {
  status: "ok" | "no_match" | "error";
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
}

interface RecallsSection {
  status: "ok" | "unavailable";
  count: number | null;
  items: Array<{ campaignNumber: string | null; component: string | null; summary: string | null }>;
}

function shapeResponse(vin: string, result: VehicleLookupResult): { vehicle: VehicleSection; recalls: RecallsSection } {
  // "invalid_vin" cannot reach here (zod rejected it with a 400 already);
  // collapse it onto "error" defensively so the union stays closed.
  const vehicleStatus: VehicleSection["status"] =
    result.status === "ok" ? "ok" : result.status === "no_match" ? "no_match" : "error";

  return {
    vehicle: {
      status: vehicleStatus,
      vin: result.vehicle?.vin ?? vin,
      year: result.vehicle?.year ?? null,
      make: result.vehicle?.make ?? null,
      model: result.vehicle?.model ?? null,
    },
    recalls: {
      status: result.recalls.status,
      count: result.recalls.count,
      items: result.recalls.topItems.map(({ campaignNumber, component, summary }) => ({
        campaignNumber,
        component,
        summary,
      })),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Per-user limiter — same reuse pattern as /api/move-tasks. Keeps a
    // misbehaving client from hammering NHTSA's shared public endpoints.
    const rlKey = getRateLimitKey(request, "vehicles:decode", { userId });
    const rl = await rateLimit(rlKey, { limit: 10, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = vinSchema.safeParse({ vin: searchParams.get("vin") ?? "" });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Enter the full 17-character VIN (letters I, O, and Q are never used).",
          code: "INVALID_VIN",
        },
        { status: 400 },
      );
    }
    const vin = parsed.data.vin.toUpperCase();

    const result = await lookupVehicleByVin(vin);
    // Belt and braces — the lib only answers invalid_vin for input zod already
    // rejects, but if validation rules ever drift, fail closed as a 400.
    if (result.status === "invalid_vin") {
      return NextResponse.json(
        {
          error: "Enter the full 17-character VIN (letters I, O, and Q are never used).",
          code: "INVALID_VIN",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(shapeResponse(vin, result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to decode vehicle:", error);
    return NextResponse.json({ error: "Failed to decode vehicle" }, { status: 500 });
  }
}
