import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname || "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg aria-hidden="true" {...props} />;
  return {
    ArrowRight: Icon,
    CalendarClock: Icon,
    PartyPopper: Icon,
    Rocket: Icon,
    Sparkles: Icon,
    Truck: Icon,
    PackageCheck: Icon,
    CheckCircle2: Icon,
  };
});

import { MoveCommandCenter } from "./move-command-center";

function t(key: string, vars: Record<string, string | number> = {}) {
  const messages: Record<string, string> = {
    commandCenter_daysToGo: "{count} days to go",
    commandCenter_oneDay: "1 day to go",
    commandCenter_daysAgo: "{count} days ago",
    commandCenter_movingDay: "Moving day",
    commandCenter_freePreviewEyebrow: "Your free move preview",
    commandCenter_freePreviewReadOnly: "Read-only",
    commandCenter_freePreviewTitle: "Your {count}-step {route} preview is ready",
    commandCenter_freePreviewBody:
      "This preview can become your full move plan with task tracking, provider transition workspace, and reminders.",
    commandCenter_freePreviewCta: "Start full move plan",
    commandCenter_freePreviewMore: "+{count} more steps are ready in your full plan.",
    commandCenter_freePreviewRouteFallback: "move",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

describe("MoveCommandCenter free preview", () => {
  it("renders a read-only personalized checklist preview with a move-plan CTA", () => {
    const markup = renderToStaticMarkup(
      <MoveCommandCenter
        activePlan={null}
        checklist={null}
        topAction={null}
        missingCriticalCount={0}
        completedCriticalCount={0}
        isPremium={false}
        freePreview={{
          checklist: { totalItems: 7, completedItems: 0 } as any,
          fromState: "NJ",
          toState: "TX",
          moveDate: "2099-06-01",
          steps: [
            {
              id: "step-1",
              title: "Transfer electric service",
              reason: "Keep lights on at the new address.",
              deadline: null,
            },
            {
              id: "step-2",
              title: "Update renter insurance",
              reason: "Avoid a coverage gap.",
              deadline: null,
            },
          ],
        }}
        t={t}
      />,
    );

    expect(markup).toContain("Your free move preview");
    expect(markup).toContain("Read-only");
    expect(markup).toContain("NJ");
    expect(markup).toContain("TX");
    expect(markup).toContain("Transfer electric service");
    expect(markup).toContain("Update renter insurance");
    expect(markup).toContain("Start full move plan");
    expect(markup).toContain('href="/moving/new"');
    expect(markup).not.toContain("settings/subscription");
  });
});
