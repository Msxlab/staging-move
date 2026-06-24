// @vitest-environment happy-dom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "./dialog";

vi.mock("lucide-react", () => ({
  X: (props: { className?: string }) => <svg data-lucide="x" className={props.className} />,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
});

function render(ui: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(ui);
  });
}

function ControlledDialog() {
  const [open, setOpen] = React.useState(true);
  const [email, setEmail] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogContent>
        <label>
          Household name
          <input aria-label="Household name" defaultValue="Test household" />
        </label>
        <label>
          Invite email
          <input
            aria-label="Invite email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent focus management", () => {
  it("does not reset focus to the first input when controlled dialog children re-render", () => {
    render(<ControlledDialog />);

    const householdName = document.querySelector<HTMLInputElement>('input[aria-label="Household name"]');
    const inviteEmail = document.querySelector<HTMLInputElement>('input[aria-label="Invite email"]');
    expect(householdName).not.toBeNull();
    expect(inviteEmail).not.toBeNull();
    expect(document.activeElement).toBe(householdName);

    act(() => {
      inviteEmail?.focus();
      inviteEmail!.value = "m";
      inviteEmail?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(document.activeElement).toBe(inviteEmail);
  });
});
