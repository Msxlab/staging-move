import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/mover-portal-auth", () => ({
  consumeMoverPortalToken: vi.fn(),
}));

import { GET } from "./route";
import { consumeMoverPortalToken } from "@/lib/mover-portal-auth";

const consumeMock = vi.mocked(consumeMoverPortalToken);

describe("GET /movers/portal/enter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("redirects an invalid token to the public origin, not the internal listener host", async () => {
    consumeMock.mockResolvedValue(null);

    // request.url is the internal 0.0.0.0:3000 listener (behind a proxy on
    // staging), but the public host arrives via x-forwarded-host.
    const request = new NextRequest("http://0.0.0.0:3000/movers/portal/enter?token=bad", {
      headers: {
        "x-forwarded-host": "locateflow-staging-owew7.ondigitalocean.app",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);
    const location = response.headers.get("location") ?? "";

    expect(location).not.toContain("0.0.0.0");
    expect(location).toBe(
      "https://locateflow-staging-owew7.ondigitalocean.app/movers/portal?error=invalid",
    );
  });

  it("redirects a valid token into the dashboard on the public origin", async () => {
    consumeMock.mockResolvedValue({
      moverId: "mover_1",
      partnerId: "partner_1",
      email: "mover@example.com",
    } as unknown as Awaited<ReturnType<typeof consumeMoverPortalToken>>);

    const request = new NextRequest("http://0.0.0.0:3000/movers/portal/enter?token=good", {
      headers: {
        "x-forwarded-host": "locateflow-staging-owew7.ondigitalocean.app",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);
    const location = response.headers.get("location") ?? "";

    expect(location).toBe(
      "https://locateflow-staging-owew7.ondigitalocean.app/movers/portal/dashboard",
    );
  });
});
