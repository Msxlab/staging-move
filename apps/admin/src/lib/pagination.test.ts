import { describe, expect, it } from "vitest";
import { parsePaginationParams } from "./pagination";

describe("admin pagination helpers", () => {
  it("clamps page and perPage to safe bounds", () => {
    const params = new URLSearchParams({ page: "-2", perPage: "500" });

    expect(parsePaginationParams(params, { defaultPerPage: 20 })).toEqual({
      page: 1,
      perPage: 100,
      skip: 0,
    });
  });

  it("supports route-specific limit params", () => {
    const params = new URLSearchParams({ page: "3", limit: "10" });

    expect(parsePaginationParams(params, { perPageParam: "limit", defaultPerPage: 50 })).toEqual({
      page: 3,
      perPage: 10,
      skip: 20,
    });
  });
});
