import { describe, expect, it } from "vitest";
import eas from "../../eas.json";

describe("mobile release profiles", () => {
  it("keeps production and internal previews on the active API host", () => {
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).toBe("https://locateflow.com/api");
    expect(eas.build.production.env.EXPO_PUBLIC_ENV).toBe("production");

    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_API_URL).toBe("https://locateflow.com/api");
    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_ENV).toBe("preview");
    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED).toBe("false");

    expect(eas.build.preview.env.EXPO_PUBLIC_API_URL).toBe("https://locateflow.com/api");
    expect(eas.build.preview.env.EXPO_PUBLIC_ENV).toBe("preview");
    expect(eas.build.preview.env.EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED).toBe("false");
  });
});
