/**
 * Locks in the confirm-before-unsubscribe contract: a bare GET render of
 * /unsubscribe must NEVER mutate preferences (email link-scanners follow
 * GETs), only the POSTed confirm form does. The page renders a confirm
 * step, and a read-only "done" view after the API redirects back.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return { MailX: icon("mail-x"), MailCheck: icon("mail-check"), MailQuestion: icon("mail-question") };
});

vi.mock("@/components/marketing/logo", () => ({
  Wordmark: () => <span>Move</span>,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/unsubscribe-actions", () => ({
  processUnsubscribe: vi.fn(() => Promise.resolve(true)),
  loadEmailOptOutState: vi.fn(() =>
    Promise.resolve({ marketingOptedOut: true, reminderOptedOut: true }),
  ),
}));

import { prisma } from "@/lib/db";
import { loadEmailOptOutState, processUnsubscribe } from "@/lib/unsubscribe-actions";
import { signUnsubscribeToken } from "@/lib/unsubscribe";
import UnsubscribePage from "./page";

const userMock = prisma.user as unknown as { findFirst: Mock };
const processMock = processUnsubscribe as unknown as Mock;
const loadStateMock = loadEmailOptOutState as unknown as Mock;

const ORIGINAL_SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;

async function renderPage(params: { t?: string; k?: string; done?: string }) {
  const element = await UnsubscribePage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "a".repeat(32);
  userMock.findFirst.mockResolvedValue({ email: "mover@example.com" });
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  } else {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = ORIGINAL_SECRET;
  }
});

describe("UnsubscribePage (GET render)", () => {
  it("renders a confirm form and does NOT opt the user out on GET", async () => {
    const token = signUnsubscribeToken("user_1");
    const html = await renderPage({ t: token, k: "marketing" });

    // The audit finding: bare GET must not mutate.
    expect(processMock).not.toHaveBeenCalled();

    expect(html).toContain("Confirm unsubscribe");
    expect(html).toContain('action="/api/unsubscribe"');
    expect(html).toContain('method="POST"');
    // Token semantics identical: the same t/k ride along as hidden fields.
    expect(html).toContain(`value="${token}"`);
    expect(html).toContain('name="k"');
    expect(html).toContain('value="marketing"');
    expect(html).toContain('name="redirect"');
    expect(html).toContain("mover@example.com");
  });

  it("renders the read-only done view after the POST redirect (still no mutation)", async () => {
    const token = signUnsubscribeToken("user_1");
    const html = await renderPage({ t: token, done: "1" });

    expect(processMock).not.toHaveBeenCalled();
    expect(loadStateMock).toHaveBeenCalledWith("user_1");
    expect(html).toContain("unsubscribed");
    expect(html).not.toContain("Confirm unsubscribe");
  });

  it("shows the invalid-link state for a bad token without touching the DB", async () => {
    const html = await renderPage({ t: "garbage" });

    expect(html).toContain("Link no longer valid");
    expect(processMock).not.toHaveBeenCalled();
    expect(userMock.findFirst).not.toHaveBeenCalled();
  });

  it("shows account-not-found for a valid token whose user is gone", async () => {
    userMock.findFirst.mockResolvedValue(null);
    const token = signUnsubscribeToken("user_gone");
    const html = await renderPage({ t: token });

    expect(html).toContain("Account not found");
    expect(processMock).not.toHaveBeenCalled();
  });
});
