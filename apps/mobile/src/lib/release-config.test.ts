import { describe, expect, it } from "vitest";
import eas from "../../eas.json";

describe("mobile release profiles", () => {
  it("keeps production on the production API and staging/internal preview off production data", () => {
    expect(eas.build.production.env.EXPO_PUBLIC_API_URL).toBe("https://locateflow.com/api");
    expect(eas.build.production.env.EXPO_PUBLIC_ENV).toBe("production");

    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_API_URL).toBe("https://staging.locateflow.com/api");
    expect(eas.build["staging-preview"].env.EXPO_PUBLIC_ENV).toBe("staging");

    expect(eas.build.preview.env.EXPO_PUBLIC_API_URL).toBe("https://staging.locateflow.com/api");
    expect(eas.build.preview.env.EXPO_PUBLIC_ENV).toBe("staging");
  });
});
