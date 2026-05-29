import { describe, expect, it } from "vitest";
import { can, resolveManagedSyncEnabled, statusAllowsMutation, type WorkspaceRole } from "./permissions";

describe("can — owner-only actions", () => {
  const ownerOnly = ["workspace.rename", "workspace.delete", "billing.manage", "member.promoteAdmin", "member.transferOwner"] as const;
  it("only OWNER passes", () => {
    for (const action of ownerOnly) {
      expect(can("OWNER", action)).toBe(true);
      for (const role of ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"] as WorkspaceRole[]) {
        expect(can(role, action)).toBe(false);
      }
    }
  });
});

describe("can — member management", () => {
  it("OWNER/ADMIN can invite; others cannot", () => {
    expect(can("OWNER", "member.invite")).toBe(true);
    expect(can("ADMIN", "member.invite")).toBe(true);
    expect(can("MEMBER", "member.invite")).toBe(false);
    expect(can("CHILD", "member.invite")).toBe(false);
    expect(can("VIEW_ONLY", "member.invite")).toBe(false);
  });

  it("ADMIN can remove MEMBER/CHILD/VIEW_ONLY but not OWNER/ADMIN", () => {
    expect(can("ADMIN", "member.remove", { targetRole: "MEMBER" })).toBe(true);
    expect(can("ADMIN", "member.remove", { targetRole: "CHILD" })).toBe(true);
    expect(can("ADMIN", "member.remove", { targetRole: "ADMIN" })).toBe(false);
    expect(can("ADMIN", "member.remove", { targetRole: "OWNER" })).toBe(false);
  });

  it("OWNER can remove anyone except the OWNER seat", () => {
    expect(can("OWNER", "member.remove", { targetRole: "ADMIN" })).toBe(true);
    expect(can("OWNER", "member.remove", { targetRole: "OWNER" })).toBe(false);
  });

  it("leave: ADMIN/MEMBER/VIEW_ONLY yes; OWNER + CHILD no", () => {
    expect(can("ADMIN", "member.leave")).toBe(true);
    expect(can("MEMBER", "member.leave")).toBe(true);
    expect(can("VIEW_ONLY", "member.leave")).toBe(true);
    expect(can("OWNER", "member.leave")).toBe(false);
    expect(can("CHILD", "member.leave")).toBe(false);
  });
});

describe("can — addresses & services", () => {
  it("CHILD views only own address/service", () => {
    expect(can("CHILD", "address.view", { isSelf: true })).toBe(true);
    expect(can("CHILD", "address.view", { isSelf: false })).toBe(false);
    expect(can("CHILD", "service.viewBasic", { isSelf: false })).toBe(false);
  });

  it("VIEW_ONLY reads but never mutates", () => {
    expect(can("VIEW_ONLY", "address.view")).toBe(true);
    expect(can("VIEW_ONLY", "service.viewBasic")).toBe(true);
    expect(can("VIEW_ONLY", "address.create")).toBe(false);
    expect(can("VIEW_ONLY", "service.create")).toBe(false);
    expect(can("VIEW_ONLY", "address.edit")).toBe(false);
  });

  it("MEMBER edits own address only", () => {
    expect(can("MEMBER", "address.edit", { isSelf: true })).toBe(true);
    expect(can("MEMBER", "address.edit", { isSelf: false })).toBe(false);
  });

  it("sensitive service fields: managers always; MEMBER only when WORKSPACE-visible", () => {
    expect(can("OWNER", "service.viewSensitive")).toBe(true);
    expect(can("ADMIN", "service.viewSensitive")).toBe(true);
    expect(can("MEMBER", "service.viewSensitive", { fieldVisibility: "WORKSPACE" })).toBe(true);
    expect(can("MEMBER", "service.viewSensitive", { fieldVisibility: "OWNER_ONLY" })).toBe(false);
    expect(can("CHILD", "service.viewSensitive", { fieldVisibility: "WORKSPACE" })).toBe(false);
    expect(can("VIEW_ONLY", "service.viewSensitive", { fieldVisibility: "WORKSPACE" })).toBe(false);
  });
});

describe("can — address change (sync) authorization", () => {
  it("OWNER/ADMIN/MEMBER may initiate; CHILD/VIEW_ONLY may not", () => {
    expect(can("OWNER", "addressChange.initiate")).toBe(true);
    expect(can("ADMIN", "addressChange.initiate")).toBe(true);
    expect(can("MEMBER", "addressChange.initiate")).toBe(true);
    expect(can("CHILD", "addressChange.initiate")).toBe(false);
    expect(can("VIEW_ONLY", "addressChange.initiate")).toBe(false);
  });

  it("CHILD completes only their own assigned sync attempt", () => {
    expect(can("CHILD", "syncAttempt.complete", { isSelf: true })).toBe(true);
    expect(can("CHILD", "syncAttempt.complete", { isSelf: false })).toBe(false);
  });

  it("only OWNER/ADMIN may manage sync on behalf of members", () => {
    expect(can("OWNER", "addressChange.manageForMembers")).toBe(true);
    expect(can("ADMIN", "addressChange.manageForMembers")).toBe(true);
    expect(can("MEMBER", "addressChange.manageForMembers")).toBe(false);
    expect(can("CHILD", "addressChange.manageForMembers")).toBe(false);
    expect(can("VIEW_ONLY", "addressChange.manageForMembers")).toBe(false);
  });

  it("managed-sync consent: stored flag wins; null defaults true for CHILD only", () => {
    expect(resolveManagedSyncEnabled("MEMBER", null)).toBe(false);
    expect(resolveManagedSyncEnabled("MEMBER", true)).toBe(true);
    expect(resolveManagedSyncEnabled("CHILD", null)).toBe(true);
    expect(resolveManagedSyncEnabled("CHILD", false)).toBe(false); // a guardian can still opt a child out
    expect(resolveManagedSyncEnabled("ADMIN", undefined)).toBe(false);
  });
});

describe("can — connectors (personal consents)", () => {
  it("OWNER/ADMIN/MEMBER connect & revoke own; CHILD/VIEW_ONLY cannot", () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER"] as WorkspaceRole[]) {
      expect(can(role, "connector.connect")).toBe(true);
      expect(can(role, "connector.revokeOwn")).toBe(true);
    }
    expect(can("CHILD", "connector.connect")).toBe(false);
    expect(can("VIEW_ONLY", "connector.connect")).toBe(false);
  });
});

describe("can — suspended status gate", () => {
  it("a SUSPENDED member keeps reads but loses mutations", () => {
    expect(can("MEMBER", "address.view", { status: "SUSPENDED" })).toBe(true);
    expect(can("MEMBER", "budget.view", { status: "SUSPENDED" })).toBe(true);
    expect(can("MEMBER", "address.create", { status: "SUSPENDED" })).toBe(false);
    expect(can("MEMBER", "addressChange.initiate", { status: "SUSPENDED" })).toBe(false);
    expect(can("OWNER", "workspace.rename", { status: "SUSPENDED" })).toBe(false);
  });

  it("statusAllowsMutation reflects the gate", () => {
    expect(statusAllowsMutation("ACTIVE")).toBe(true);
    expect(statusAllowsMutation("OVERFLOW")).toBe(true);
    expect(statusAllowsMutation("SUSPENDED")).toBe(false);
  });
});
