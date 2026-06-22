import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROVIDER_ACCOUNT_UNCHANGED_COPY } from "@locateflow/shared";
import {
  MoveTaskTrustConfirmation,
  isVerifiedIntegrationTask,
  moveTaskTrustBadgeLabel,
  shouldShowMoveTaskTrustConfirmation,
  shouldShowMoveTaskTrustLegalLine,
} from "./trust-copy";

const TRUST_ACTION_TYPES = ["STOP_SERVICE", "START_SERVICE", "TRANSFER_SERVICE", "CANCEL_OR_CLOSE", "UPDATE_ADDRESS"];
const BLOCKED_PHRASES = ["auto-sync", "verified sync", "official partner", "official USPS", "provider offer"];

describe("point-of-action trust confirmation", () => {
  it("renders the unchanged guarantee and legal line for every trust action type after done and dismissed", () => {
    for (const actionType of TRUST_ACTION_TYPES) {
      for (const terminalState of [
        { isDone: false, isDismissed: false },
        { isDone: true, isDismissed: false },
        { isDone: false, isDismissed: true },
      ]) {
        const input = { actionType, variant: "variant" as const, ...terminalState };
        const markup = renderToStaticMarkup(<MoveTaskTrustConfirmation {...input} />);

        expect(shouldShowMoveTaskTrustConfirmation(input)).toBe(true);
        expect(shouldShowMoveTaskTrustLegalLine(input)).toBe(true);
        expect(markup).toContain("LocateFlow only");
        expect(markup).toContain("your provider account is unchanged");
        expect(markup).toContain(PROVIDER_ACCOUNT_UNCHANGED_COPY);
      }
    }
  });

  it("does not render the unchanged guarantee for a verified live-integration task", () => {
    const input = {
      actionType: "STOP_SERVICE",
      localEffect: { localOnly: false, noExternalAutomation: false },
      variant: "variant" as const,
      isDone: true,
      isDismissed: false,
    };

    expect(isVerifiedIntegrationTask(input.localEffect)).toBe(true);
    expect(shouldShowMoveTaskTrustConfirmation(input)).toBe(false);
    expect(renderToStaticMarkup(<MoveTaskTrustConfirmation {...input} />)).toBe("");
  });

  it("keeps flag-off control behavior unchanged", () => {
    expect(
      shouldShowMoveTaskTrustConfirmation({
        actionType: "STOP_SERVICE",
        variant: "control",
        isDone: false,
        isDismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMoveTaskTrustConfirmation({
        actionType: "STOP_SERVICE",
        localEffect: { localOnly: true },
        variant: "control",
        isDone: false,
        isDismissed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMoveTaskTrustConfirmation({
        actionType: "STOP_SERVICE",
        localEffect: { localOnly: true },
        variant: "control",
        isDone: true,
        isDismissed: false,
      }),
    ).toBe(false);
    expect(
      moveTaskTrustBadgeLabel({
        actionType: "STOP_SERVICE",
        localEffect: { localOnly: true },
        variant: "control",
      }),
    ).toBe("LocateFlow only");
  });

  it("does not add blocked trust phrases to rendered copy", () => {
    const markup = renderToStaticMarkup(
      <MoveTaskTrustConfirmation actionType="TRANSFER_SERVICE" variant="variant" isDone />,
    ).toLowerCase();

    for (const phrase of BLOCKED_PHRASES) {
      expect(markup).not.toContain(phrase.toLowerCase());
    }
  });

  it("keeps connector copy guided-first and bounded to actually supported authorized connectors", () => {
    const cwd = process.cwd();
    const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
    const en = JSON.parse(readFileSync(path.join(webRoot, "src", "i18n", "messages", "en.json"), "utf8")) as {
      landing: Record<string, string>;
    };

    expect(en.landing.connector_subtitle).toMatch(/^LocateFlow guides you through/);
    expect(en.landing.connector_subtitle).toContain("supported authorized connector");
    expect(en.landing.connector_disclaimer).toContain("supported partners you connect and authorize");
  });
});
