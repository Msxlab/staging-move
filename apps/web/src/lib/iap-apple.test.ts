import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
// node-forge ships no bundled types and @types/node-forge isn't a dependency;
// require it as `any` so this test compiles without adding a types package.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge: any = require("node-forge");
import {
  APPLE_INTERMEDIATE_OID,
  APPLE_LEAF_OID,
  certContainsOid,
  oidToDerBytes,
  verifyAppleJws,
} from "./iap-apple";

// ─────────────────────────────────────────────────────────────────────────
// Finding (1): Apple JWS verification was missing the Apple-specific OID
// checks. A cert chain that merely chains up to AppleRootCA-G3 (which Apple
// issues for MANY unrelated purposes) used to pass. These tests lock in the
// OID-encoding and OID-presence logic that backs the new enforcement.
// ─────────────────────────────────────────────────────────────────────────

// Mint a throwaway self-signed cert, optionally embedding a custom extension
// OID, and return it as a Node X509Certificate. The OID detector scans raw
// DER, so the key type / validity are irrelevant — only the bytes matter.
function makeCertWithOids(extensionOids: string[]): X509Certificate {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 60 * 60_000);
  const attrs = [{ name: "commonName", value: "test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  // node-forge serializes any extension with an `id` into the cert DER, which
  // is exactly the raw-OID presence our detector keys on.
  cert.setExtensions(extensionOids.map((id) => ({ id, critical: false, value: "" })));
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return new X509Certificate(Buffer.from(der, "binary"));
}

describe("oidToDerBytes", () => {
  it("encodes the Apple leaf OID to its canonical DER value octets", () => {
    // 1.2.840.113635.100.6.11.1 — first two arcs collapse to 0x2A (42),
    // 840 → 0x86 0x48, 113635 → 0x86 0xF7 0x63, then 100, 6, 11, 1.
    expect([...oidToDerBytes(APPLE_LEAF_OID)]).toEqual([
      0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x0b, 0x01,
    ]);
  });

  it("encodes the Apple intermediate OID to its canonical DER value octets", () => {
    expect([...oidToDerBytes(APPLE_INTERMEDIATE_OID)]).toEqual([
      0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x02, 0x01,
    ]);
  });

  it("rejects malformed OID strings", () => {
    expect(() => oidToDerBytes("not-an-oid")).toThrow("APPLE_OID_INVALID");
    expect(() => oidToDerBytes("1")).toThrow("APPLE_OID_INVALID");
  });
});

describe("certContainsOid", () => {
  it("detects the Apple App Store leaf OID when present", () => {
    const cert = makeCertWithOids([APPLE_LEAF_OID]);
    expect(certContainsOid(cert, oidToDerBytes(APPLE_LEAF_OID))).toBe(true);
  });

  it("detects the Apple WWDR intermediate OID when present", () => {
    const cert = makeCertWithOids([APPLE_INTERMEDIATE_OID]);
    expect(certContainsOid(cert, oidToDerBytes(APPLE_INTERMEDIATE_OID))).toBe(true);
  });

  it("returns false when the Apple marker OID is absent (the forgery case)", () => {
    // A cert that chains to G3 but is NOT an App Store cert: it carries some
    // other Apple OID, not the leaf marker. The detector must reject it.
    const cert = makeCertWithOids(["1.2.840.113635.100.6.1.2"]);
    expect(certContainsOid(cert, oidToDerBytes(APPLE_LEAF_OID))).toBe(false);
  });
});

describe("verifyAppleJws structural guards", () => {
  it("rejects a malformed JWS", () => {
    expect(() => verifyAppleJws("not.a.jws.token")).toThrow();
    expect(() => verifyAppleJws("only-one-part")).toThrow("APPLE_JWS_MALFORMED");
  });

  it("rejects a JWS whose header omits an x5c chain", () => {
    const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({})).toString("base64url");
    expect(() => verifyAppleJws(`${header}.${payload}.sig`)).toThrow("APPLE_JWS_MISSING_X5C");
  });
});
