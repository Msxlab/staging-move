"use client";

import { useState } from "react";
import { User, Users } from "lucide-react";

import { SwitchMode, SwitchToggle } from "@/components/ui/switch-mode";
import { FileUpload2, type UploadedDoc } from "@/components/ui/file-upload-2";
import { Notification3 } from "@/components/ui/notification-3";

/* ──────────────────────────────────────────────────────────────────────────
   Preview sections for the latest batch of re-themed shadcn components:
   switch-mode, file-upload-2, notification-3. Each is re-themed onto our
   sapphire (no-gold) tokens and repurposed to its LocateFlow use-case.
   Kept in a child module so the shared /dev/shadcn-batch page can compose it
   alongside the other batches without merge churn.
─────────────────────────────────────────────────────────────────────────── */

export function SwitchUploadNotifySections() {
  const [dashboardView, setDashboardView] = useState("mine");
  const [readyDocs, setReadyDocs] = useState<UploadedDoc[]>([]);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          switch-mode
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Theme toggle + My view / Family view switch
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Animated light/dark theme toggle — track, knob, border and sun/moon
          glyphs all resolve through our theme vars (no hardcoded hex). The same
          two-state mechanism is reused as the dashboard &ldquo;My view / Family
          view&rdquo; switch with the sapphire active pill.
        </p>
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <SwitchMode width={120} height={60} />
            <span className="text-xs text-muted-foreground">
              Light / dark theme toggle (settings &amp; header)
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SwitchToggle
              ariaLabel="Dashboard view"
              value={dashboardView}
              onChange={setDashboardView}
              options={[
                { value: "mine", label: "My view", icon: <User className="h-4 w-4" /> },
                {
                  value: "family",
                  label: "Family view",
                  icon: <Users className="h-4 w-4" />,
                },
              ]}
            />
            <span className="text-xs text-muted-foreground">
              Dashboard scope:{" "}
              <span className="font-medium text-foreground">
                {dashboardView === "mine" ? "My view" : "Family view"}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          file-upload-2
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Dossier document uploader
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Drag-drop leases, mover quotes and bank/subscription statements. The
          file-size + simulated upload-progress UI is preserved; ready files feed
          the dossier and the statement &rarr; AI subscription-import flow. Try a
          file named &ldquo;lease.pdf&rdquo;, &ldquo;quote.pdf&rdquo; or
          &ldquo;statement.csv&rdquo; to see auto-classification.
        </p>
        <div className="flex flex-col items-center">
          <FileUpload2 onReadyChange={setReadyDocs} />
          {readyDocs.length > 0 && (
            <p className="mt-3 text-center text-xs font-medium text-success">
              {readyDocs.length} document{readyDocs.length > 1 ? "s" : ""} ready for
              the dossier
            </p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          notification-3
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Reminders &amp; notifications panel
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          The activity feed repurposed into the LocateFlow reminders centre:
          reminders due, provider replies, renewals and family joins, with
          All / New / Tasks / Digest tabs, inline accept/decline on actionable
          items, and the &ldquo;All caught up&rdquo; empty state. Clear the
          actionable items or open an empty tab to see the empty state.
        </p>
        <div className="flex justify-center">
          <Notification3 />
        </div>
      </section>
    </>
  );
}
