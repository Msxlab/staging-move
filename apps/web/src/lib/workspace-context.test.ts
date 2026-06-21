import { describe, expect, it } from "vitest";
import {
  materializeContextFlags,
  resolveWorkspaceIdFromRequest,
  resolveWorkspaceSelectionFromRequest,
} from "./workspace-context";

function req(headers: Record<string, string>): Request {
  return new Request("https://app.locateflow.com/api/x", { headers });
}

describe("resolveWorkspaceIdFromRequest", () => {
  it("prefers the X-Workspace-Id header", () => {
    const r = req({ "x-workspace-id": "ws_header123", cookie: "lf_workspace_id=ws_cookie99" });
    expect(resolveWorkspaceIdFromRequest(r)).toBe("ws_header123");
    expect(resolveWorkspaceSelectionFromRequest(r)).toEqual({
      workspaceId: "ws_header123",
      source: "header",
    });
  });

  it("falls back to the cookie when no header", () => {
    const r = req({ cookie: "other=1; lf_workspace_id=ws_cookie99; x=2" });
    expect(resolveWorkspaceIdFromRequest(r)).toBe("ws_cookie99");
    expect(resolveWorkspaceSelectionFromRequest(r)).toEqual({
      workspaceId: "ws_cookie99",
      source: "cookie",
    });
  });

  it("returns null when neither is present", () => {
    expect(resolveWorkspaceIdFromRequest(req({}))).toBeNull();
    expect(resolveWorkspaceSelectionFromRequest(req({}))).toEqual({
      workspaceId: null,
      source: "none",
    });
  });

  it("ignores a malformed header (injection guard) and uses the cookie", () => {
    const r = req({ "x-workspace-id": "bad id with spaces", cookie: "lf_workspace_id=ws_ok" });
    expect(resolveWorkspaceIdFromRequest(r)).toBe("ws_ok");
  });
});

describe("materializeContextFlags", () => {
  it("OWNER manages members and can sync", () => {
    expect(materializeContextFlags("OWNER", "ACTIVE")).toEqual({
      isOwner: true,
      canManageMembers: true,
      canInitiateSync: true,
    });
  });

  it("MEMBER can sync but not manage members", () => {
    const f = materializeContextFlags("MEMBER", "ACTIVE");
    expect(f.isOwner).toBe(false);
    expect(f.canManageMembers).toBe(false);
    expect(f.canInitiateSync).toBe(true);
  });

  it("CHILD cannot initiate a sync", () => {
    expect(materializeContextFlags("CHILD", "ACTIVE").canInitiateSync).toBe(false);
  });

  it("a SUSPENDED member loses sync", () => {
    expect(materializeContextFlags("MEMBER", "SUSPENDED").canInitiateSync).toBe(false);
  });
});
