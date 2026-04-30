import { NextResponse, type NextRequest } from "next/server";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

type PlacesLookupKind = "autocomplete" | "details";

const LIMIT_DEFAULTS = {
  autocomplete: {
    dailyUserEnv: "PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT",
    dailyIpEnv: "PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT",
    dailyUserFallback: 250,
    dailyIpFallback: 1000,
  },
  details: {
    dailyUserEnv: "PLACES_DETAILS_DAILY_USER_LIMIT",
    dailyIpEnv: "PLACES_DETAILS_DAILY_IP_LIMIT",
    dailyUserFallback: 250,
    dailyIpFallback: 1000,
  },
} satisfies Record<PlacesLookupKind, {
  dailyUserEnv: string;
  dailyIpEnv: string;
  dailyUserFallback: number;
  dailyIpFallback: number;
}>;

function readDailyLimit(key: string, fallback: number) {
  const value = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function isPlacesAutocompleteEnabled() {
  const value = (await getRuntimeConfigValue("PLACES_AUTOCOMPLETE_ENABLED")) || "true";
  return value.toLowerCase() !== "false";
}

export async function enforcePlacesCostControls(
  request: NextRequest,
  userId: string,
  kind: PlacesLookupKind,
) {
  const minuteLimit = await rateLimit(getRateLimitKey(request, `places:${kind}`), {
    limit: 45,
    windowSeconds: 60,
  });
  if (!minuteLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const day = dayKey();
  const ip = resolveClientIP(request);
  const defaults = LIMIT_DEFAULTS[kind];
  const [userDaily, ipDaily] = await Promise.all([
    rateLimit(`places:${kind}:daily:user:${userId}:${day}`, {
      limit: readDailyLimit(defaults.dailyUserEnv, defaults.dailyUserFallback),
      windowSeconds: 24 * 60 * 60,
    }),
    rateLimit(`places:${kind}:daily:ip:${ip}:${day}`, {
      limit: readDailyLimit(defaults.dailyIpEnv, defaults.dailyIpFallback),
      windowSeconds: 24 * 60 * 60,
    }),
  ]);

  if (!userDaily.success || !ipDaily.success) {
    console.warn("[PLACES] daily cap reached", {
      kind,
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

  return null;
}
