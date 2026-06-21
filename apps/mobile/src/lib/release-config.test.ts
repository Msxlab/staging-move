import { describe, expect, it } from "vitest";
import eas from "../../eas.json";

describe("mobile release profiles", () => {
  it("keeps production builds on the active API host", () => {
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).toBe("https://locateflow.com/api");
    expect(eas.build.production.env.EXPO_PUBLIC_APP_URL).toBe("https://locateflow.com");
    expect(eas.build.production.env.EXPO_PUBLIC_ENV).toBe("production");

    expect(eas.build["play-internal"].extends).toBe("production");
    expect(eas.build["play-internal"].distribution).toBe("store");
    expect(eas.build["play-internal"].android.buildType).toBe("app-bundle");
  });

  it("keeps non-production mobile profiles off the production API", () => {
    for (const profileName of ["preview", "staging-preview"] as const) {
      const env = eas.build[profileName].env;

      expect(env.EXPO_PUBLIC_API_URL).toBe("https://staging.locateflow.com/api");
      expect(env.EXPO_PUBLIC_APP_URL).toBe("https://staging.locateflow.com");
      expect(env.EXPO_PUBLIC_API_URL).not.toBe(eas.build.production.env.EXPO_PUBLIC_API_URL);
      expect(env.EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED).toBe("false");
    }

    expect(eas.build.preview.env.EXPO_PUBLIC_ENV).toBe("preview");
    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_ENV).toBe("staging");
  });
});
