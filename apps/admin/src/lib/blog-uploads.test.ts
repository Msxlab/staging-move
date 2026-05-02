import { describe, expect, it } from "vitest";
import {
  BLOG_DELETE_IMAGE_AUDIT_ACTION,
  BLOG_UPLOAD_IMAGE_AUDIT_ACTION,
  ADMIN_AUDIT_ENTITY_ID_MAX,
  getBlogImageAuditEntityId,
  getBlogImageKeyFromAuditRow,
} from "./blog-uploads";

describe("blog image audit helpers", () => {
  it("keeps audit action and entity ids within AdminAuditLog column limits", () => {
    const key = "blog/2026-05/admin_123456789012345678901234567890/uploaded-file-name.webp";
    const entityId = getBlogImageAuditEntityId(key);

    expect(BLOG_UPLOAD_IMAGE_AUDIT_ACTION.length).toBeLessThanOrEqual(20);
    expect(BLOG_DELETE_IMAGE_AUDIT_ACTION.length).toBeLessThanOrEqual(20);
    expect(entityId).toHaveLength(ADMIN_AUDIT_ENTITY_ID_MAX);
    expect(getBlogImageAuditEntityId(key)).toBe(entityId);
  });

  it("stores short legacy keys directly and recovers full keys from changes", () => {
    expect(getBlogImageAuditEntityId("blog-short-key")).toBe("blog-short-key");
    expect(
      getBlogImageKeyFromAuditRow({
        entityId: "img_audit_id",
        changes: JSON.stringify({ key: "blog/2026-05/admin/long-image-key.webp" }),
      }),
    ).toBe("blog/2026-05/admin/long-image-key.webp");
    expect(getBlogImageKeyFromAuditRow({ entityId: "legacy-key", changes: null })).toBe("legacy-key");
  });
});
