import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));

import ExpensesRedirectPage from "./page";

describe("/expenses", () => {
  it("redirects legacy expense links to budget", () => {
    expect(() => ExpensesRedirectPage()).toThrow("NEXT_REDIRECT:/budget");
    expect(redirect).toHaveBeenCalledWith("/budget");
  });
});
