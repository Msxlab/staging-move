export interface FingerprintInput {
  ip: string;
  userAgent: string;
  acceptLanguage?: string | null;
  secChUa?: string | null;
}

function normalizeIp(ip: string): string {
  return ip.trim().replace(/^\[/, "").replace(/\]$/, "").split("%")[0].toLowerCase();
}

export function bucketClientIp(ip: string): string {
  const normalized = normalizeIp(ip);
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.every((octet) => octet >= 0 && octet <= 255)) {
      return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
    }
  }

  if (normalized.includes(":")) {
    const [leftRaw, rightRaw = ""] = normalized.split("::");
    const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
    const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
    const missing = Math.max(0, 8 - left.length - right.length);
    const expanded = [...left, ...Array(missing).fill("0"), ...right]
      .slice(0, 8)
      .map((part) => part.padStart(4, "0"));
    if (expanded.length >= 4 && expanded.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) {
      return `${expanded.slice(0, 4).join(":")}::/64`;
    }
  }

  return normalized || "unknown";
}

function normalizeHeader(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "unknown";
}

export function buildFingerprintMaterial(input: FingerprintInput): string {
  return [
    `ip:${bucketClientIp(input.ip)}`,
    `ua:${normalizeHeader(input.userAgent)}`,
    `al:${normalizeHeader(input.acceptLanguage)}`,
    `ch:${normalizeHeader(input.secChUa)}`,
  ].join("|");
}

export async function hashFingerprintMaterial(material: string): Promise<string> {
  const data = new TextEncoder().encode(material);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateAdminSessionFingerprint(input: FingerprintInput): Promise<string> {
  return hashFingerprintMaterial(buildFingerprintMaterial(input));
}
