import { describe, expect, it } from "vitest";
import { deriveBreadcrumb, initialsFromEmail } from "./topbar-breadcrumb";

describe("deriveBreadcrumb", () => {
  it("maps the root path to Core › Dashboard", () => {
    expect(deriveBreadcrumb("/")).toEqual({ section: "Core", page: "Dashboard" });
  });

  it("maps a top-level nav route to its group + label", () => {
    expect(deriveBreadcrumb("/users")).toEqual({ section: "Core", page: "Users" });
    expect(deriveBreadcrumb("/providers")).toEqual({ section: "Content", page: "Providers" });
    expect(deriveBreadcrumb("/logs")).toEqual({ section: "System", page: "Audit Logs" });
    expect(deriveBreadcrumb("/help-center")).toEqual({ section: "Communication", page: "Help Center" });
  });

  it("resolves nested detail routes to the parent module", () => {
    expect(deriveBreadcrumb("/users/abc-123")).toEqual({ section: "Core", page: "Users" });
    expect(deriveBreadcrumb("/providers/42/edit")).toEqual({ section: "Content", page: "Providers" });
  });

  it("does not cross-match sibling routes that share a prefix", () => {
    // "/connector-metrics" must NOT resolve to "Connectors".
    expect(deriveBreadcrumb("/connector-metrics")).toEqual({ section: "System", page: "Connector Metrics" });
    expect(deriveBreadcrumb("/connector-fallbacks")).toEqual({ section: "System", page: "Connector Fallbacks" });
    expect(deriveBreadcrumb("/connectors/some-id")).toEqual({ section: "System", page: "Connectors" });
  });

  it("ignores trailing slashes, query strings, and hashes", () => {
    expect(deriveBreadcrumb("/users/")).toEqual({ section: "Core", page: "Users" });
    expect(deriveBreadcrumb("/users?page=2")).toEqual({ section: "Core", page: "Users" });
    expect(deriveBreadcrumb("/users#top")).toEqual({ section: "Core", page: "Users" });
  });

  it("falls back to a title-cased segment for routes outside the nav model", () => {
    expect(deriveBreadcrumb("/billing")).toEqual({ section: null, page: "Billing" });
    expect(deriveBreadcrumb("/email-templates/3")).toEqual({ section: null, page: "Email Templates" });
  });

  it("treats empty input as the dashboard", () => {
    expect(deriveBreadcrumb("")).toEqual({ section: "Core", page: "Dashboard" });
  });
});

describe("initialsFromEmail", () => {
  it("uses the first letters of dotted local parts", () => {
    expect(initialsFromEmail("jane.doe@locateflow.com")).toBe("JD");
    expect(initialsFromEmail("sam_j-smith@locateflow.com")).toBe("SJ");
  });

  it("uses the first two letters of single-token local parts", () => {
    expect(initialsFromEmail("mustafa@axtrasolutions.com")).toBe("MU");
  });

  it("falls back to AD when no email is available", () => {
    expect(initialsFromEmail(undefined)).toBe("AD");
    expect(initialsFromEmail("")).toBe("AD");
    expect(initialsFromEmail("@locateflow.com")).toBe("AD");
  });
});
