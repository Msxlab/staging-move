import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";
import { searchAddressAutocomplete } from "@/lib/address-autocomplete";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

function readDailyLimit(key: string, fallback: number) {
  const value = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function isPlacesAutocompleteEnabled() {
  const value = (await getRuntimeConfigValue("PLACES_AUTOCOMPLETE_ENABLED")) || "true";
  return value.toLowerCase() !== "false";
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    if (!await isPlacesAutocompleteEnabled()) {
      return NextResponse.json({
        enabled: false,
        predictions: [],
        code: "PLACES_AUTOCOMPLETE_DISABLED",
      });
    }

    const key = getRateLimitKey(request, "places:autocomplete");
    const limited = await rateLimit(key, { limit: 45, windowSeconds: 60 });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const day = dayKey();
    const ip = resolveClientIP(request);
    const [userDaily, ipDaily] = await Promise.all([
      rateLimit(`places:autocomplete:daily:user:${userId}:${day}`, {
        limit: readDailyLimit("PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT", 250),
        windowSeconds: 24 * 60 * 60,
      }),
      rateLimit(`places:autocomplete:daily:ip:${ip}:${day}`, {
        limit: readDailyLimit("PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT", 1000),
        windowSeconds: 24 * 60 * 60,
      }),
    ]);
    if (!userDaily.success || !ipDaily.success) {
      console.warn("[PLACES] autocomplete daily cap reached", {
        userId,
        ip,
        userCapReached: !userDaily.success,
        ipCapReached: !ipDaily.success,
      });
      return NextResponse.json(
        {
          error: "Address autocomplete daily limit reached. Enter the address manually or try again tomorrow.",
          code: "PLACES_DAILY_CAP_REACHED",
        },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") || "";
    const sessionToken = searchParams.get("sessionToken");
    const result = await searchAddressAutocomplete({ query: input, sessionToken });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Address autocomplete search failed:", error);
    return NextResponse.json({ error: "Failed to search addresses" }, { status: 500 });
  }
}
