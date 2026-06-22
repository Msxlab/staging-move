/**
 * MOVE WIDGET (Android) — the home-screen widget UI, defined in JS so it is
 * typecheck-verifiable here (the actual on-device render still requires the
 * owner's native EAS build — see apps/mobile/WIDGET-SETUP.md).
 *
 * Built with `react-native-android-widget`: the widget tree is plain JS
 * (FlexWidget / TextWidget), the same snapshot the data layer persists drives
 * the copy, and the OS re-renders by calling our `renderWidget` callback. We
 * read the snapshot from the AsyncStorage mirror the data layer writes
 * (WIDGET_SNAPSHOT_KEY) so the widget and the in-app dashboard never disagree.
 *
 * Glanceable contract (matches the task spec):
 *   - MOVE COUNTDOWN  → "N days to go" / "Moving day!" / "N days ago"
 *   - NEXT TASK       → the single next open task title
 *   - READINESS %     → the dashboard readiness ring value
 *
 * Tapping the widget deep-links into the app via the `clickAction`/`OPEN_APP`
 * convention; the task handler routes that. NOTE: only the JS here is verified;
 * native registration + render are validated by the EAS build + device test.
 */

import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  readWidgetSnapshot,
  emptyWidgetSnapshot,
  type WidgetSnapshot,
} from "@/lib/widget-data";

/** Brand palette — kept literal (the widget process has no theme provider). */
const COLORS = {
  bg: "#0A0F18",
  card: "#121A28",
  border: "#1E2A3D",
  text: "#F2F5FA",
  textDim: "#8A98AC",
  accent: "#CBA45E",
  success: "#4FD1B5",
} as const;

/** "N days to go" / "Moving day!" / "N days ago" / no-plan headline. */
export function countdownHeadline(snapshot: WidgetSnapshot): string {
  if (snapshot.daysToGo === null || snapshot.phase === "none") {
    return "Plan your move";
  }
  if (snapshot.phase === "today") return "Moving day!";
  const n = Math.abs(snapshot.daysToGo);
  if (snapshot.phase === "past") {
    return n === 1 ? "1 day ago" : `${n} days ago`;
  }
  return n === 1 ? "1 day to go" : `${n} days to go`;
}

/** Secondary line: the single next task, or an "all set" / CTA fallback. */
export function nextLine(snapshot: WidgetSnapshot): string {
  if (snapshot.phase === "none") return "Tap to start your move plan";
  if (snapshot.nextTaskTitle) return snapshot.nextTaskTitle;
  if (snapshot.readinessPercent >= 100) return "You're all set";
  return "No open tasks right now";
}

/**
 * The widget tree. Pure JSX over `react-native-android-widget` primitives;
 * `clickAction="OPEN_APP"` makes the whole tile open the app (handled in the
 * task handler below). Sized for the default 2x2 / 4x2 widget cells.
 */
export function MoveWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const headline = countdownHeadline(snapshot);
  const next = nextLine(snapshot);
  const hasPlan = snapshot.phase !== "none" && snapshot.daysToGo !== null;
  const readinessColor =
    snapshot.readinessPercent >= 100 ? COLORS.success : COLORS.accent;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: COLORS.bg,
        borderRadius: 20,
        padding: 16,
      }}
    >
      {/* Eyebrow */}
      <TextWidget
        text="MOVE · YOUR MOVE"
        style={{ fontSize: 9, fontWeight: "700", letterSpacing: 0.5, color: COLORS.accent }}
      />

      {/* Countdown headline */}
      <TextWidget
        text={headline}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 22, fontWeight: "800", color: COLORS.text }}
      />

      {/* Next task / fallback line */}
      <TextWidget
        text={next}
        maxLines={2}
        truncate="END"
        style={{ fontSize: 13, fontWeight: "500", color: COLORS.textDim }}
      />

      {/* Readiness footer — only meaningful with an active plan */}
      {hasPlan ? (
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "match_parent",
          }}
        >
          <TextWidget
            text="Readiness"
            style={{ fontSize: 11, fontWeight: "600", color: COLORS.textDim }}
          />
          <TextWidget
            text={`${snapshot.readinessPercent}%`}
            style={{ fontSize: 15, fontWeight: "800", color: readinessColor }}
          />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Tap to open LocateFlow"
          style={{ fontSize: 11, fontWeight: "600", color: COLORS.accent }}
        />
      )}
    </FlexWidget>
  );
}

/**
 * `renderWidget` callback the OS invokes (via requestWidgetUpdate and on widget
 * lifecycle events). Reads the latest persisted snapshot, falling back to the
 * empty snapshot so the widget always has something coherent to draw.
 */
export async function renderMoveWidget() {
  const snapshot = (await readWidgetSnapshot()) ?? emptyWidgetSnapshot();
  return <MoveWidget snapshot={snapshot} />;
}

/**
 * WIDGET TASK HANDLER — registered as the app's background widget entry point
 * (see app/widget-task-handler.tsx / index.js registration in WIDGET-SETUP.md).
 * The OS calls this for every widget lifecycle event; we (re)render the tree
 * from the freshly-read snapshot. A WIDGET_CLICK with no special action falls
 * through to the default OPEN_APP behavior wired on the root FlexWidget.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, renderWidget } = props;
  if (widgetInfo.widgetName !== "MoveWidget") return;
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
    case "WIDGET_CLICK":
      renderWidget(await renderMoveWidget());
      break;
    case "WIDGET_DELETED":
    default:
      break;
  }
}
