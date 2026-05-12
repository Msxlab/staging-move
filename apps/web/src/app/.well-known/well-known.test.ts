import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as AasaGet } from "./apple-app-site-association/route";
import { GET as AssetlinksGet } from "./assetlinks.json/route";

const ORIG_TEAM = process.env.APPLE_TEAM_ID;
const ORIG_FP = process.env.ANDROID_APP_FINGERPRINTS;

describe("/.well-known routes", () => {
  beforeEach(() => {
    delete process.env.APPLE_TEAM_ID;
    delete process.env.ANDROID_APP_FINGERPRINTS;
  });

  afterEach(() => {
    if (ORIG_TEAM === undefined) delete process.env.APPLE_TEAM_ID;
    else process.env.APPLE_TEAM_ID = ORIG_TEAM;
    if (ORIG_FP === undefined) delete process.env.ANDROID_APP_FINGERPRINTS;
    else process.env.ANDROID_APP_FINGERPRINTS = ORIG_FP;
  });

  describe("apple-app-site-association", () => {
    it("returns JSON content type and contains applinks + webcredentials", async () => {
      process.env.APPLE_TEAM_ID = "TEST1234567";
      const res = AasaGet();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = JSON.parse(await res.text());
      expect(body.applinks.details[0].appID).toBe("TEST1234567.com.locateflow.mobile");
      expect(body.applinks.details[0].paths).toContain("/mobile/oauth");
      expect(body.applinks.details[0].paths).toContain("/reset-password");
      expect(body.applinks.details[0].paths).toContain("/blog/*");
      expect(body.webcredentials.apps).toEqual(["TEST1234567.com.locateflow.mobile"]);
    });

    it("ships a TODO placeholder when APPLE_TEAM_ID is missing", async () => {
      const res = AasaGet();
      const body = JSON.parse(await res.text());
      expect(body.applinks.details[0].appID).toContain("TEAMID-TODO");
    });
  });

  describe("assetlinks.json", () => {
    it("returns the package name and fingerprints from env", async () => {
      process.env.ANDROID_APP_FINGERPRINTS =
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99," +
        "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00";
      const res = AssetlinksGet();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = JSON.parse(await res.text());
      expect(body[0].target.namespace).toBe("android_app");
      expect(body[0].target.package_name).toBe("com.locateflow.mobile");
      expect(body[0].target.sha256_cert_fingerprints).toHaveLength(2);
      expect(body[0].relation).toContain("delegate_permission/common.handle_all_urls");
    });

    it("ships the placeholder fingerprint when ANDROID_APP_FINGERPRINTS is missing", async () => {
      const res = AssetlinksGet();
      const body = JSON.parse(await res.text());
      expect(body[0].target.sha256_cert_fingerprints[0]).toMatch(/^AA(:AA){31}$/);
    });
  });
});
