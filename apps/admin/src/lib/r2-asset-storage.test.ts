import { describe, expect, it } from "vitest";
import { validateR2AssetStorageConfigShape } from "./r2-asset-storage";

const BASE_CONFIG = {
  endpoint: "abc123.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "locateflow",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  publicBaseUrl: "https://assets.locateflow.com",
};

describe("R2 asset storage config validation", () => {
  it("accepts a bare R2 endpoint host and normalizes it to https", () => {
    const result = validateR2AssetStorageConfigShape(BASE_CONFIG);

    expect(result.ok).toBe(true);
    expect(result.config?.endpoint).toBe(
      "https://abc123.r2.cloudflarestorage.com",
    );
    expect(result.summary).toMatchObject({
      endpointHost: "abc123.r2.cloudflarestorage.com",
      publicBaseUrlHost: "assets.locateflow.com",
      bucket: "locateflow",
      region: "auto",
      hasAccessKeyId: true,
      hasSecretAccessKey: true,
    });
  });

  it("rejects endpoints that include the bucket path", () => {
    const result = validateR2AssetStorageConfigShape({
      ...BASE_CONFIG,
      endpoint: "https://abc123.r2.cloudflarestorage.com/locateflow",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("R2_ENDPOINT must not include the bucket path");
  });

  it("rejects using the public asset domain as the signed upload endpoint", () => {
    const result = validateR2AssetStorageConfigShape({
      ...BASE_CONFIG,
      endpoint: "https://assets.locateflow.com",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "R2_ENDPOINT must be the S3 API endpoint, not the public asset domain",
    );
  });
});
