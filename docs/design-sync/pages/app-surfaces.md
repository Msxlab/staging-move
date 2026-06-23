# Design ↔ Code Gap — App surfaces (Invitations, Reminders, Search, Help)

**Area:** app-surfaces · GAP ANALYSIS ONLY (no code changes).

**Design sources (source of truth), read in full incl. the `<script type="text/x-dc">` logic blocks:**
- `Initial check requested-handoff (7)/initial-check-requested/project/Invitations.dc.html`
- `…/Reminders.dc.html`
- `…/Search.dc.html`
- `…/Help.dc.html`

All four are 390×844 mobile phone-frame mockups on `#0A0F1C`/`#06080f`, DM Sans body + Playfair Display serif headings, **Gold `#CBA45E`/`#DCBC7C` accent** (NOT teal/green — matches the design-system delta finding that Gold is the shipped default), card surface `#121B2D`, border `rgba(110,150,225,0.12)`, semantic green `#54CB7E` / amber `#E0A85A` / red `#E25C5C` / teal `#37C2C9`. Each supports an `embed` prop that strips the phone chrome.

**Current implementation compared:**
- Invitations → mobile `apps/mobile/app/invitations/[token].tsx` (accept screen) + web `apps/web/src/app/(app)/settings/workspace/page.tsx` (invite/manage) + web `apps/web/src/components/layout/pending-invitations-banner.tsx`.
- Reminders → mobile `apps/mobile/app/reminders/index.tsx` (web has no `/reminders` page; reminders live in `/notifications` + `/services` attention strip).
- Search → mobile `apps/mobile/app/search.tsx` + web `apps/web/src/components/layout/global-search.tsx` (⌘K modal).
- Help → mobile `apps/mobile/app/help/index.tsx` + `app/help/tickets.tsx` + web `apps/web/src/app/help/page.tsx` + `apps/web/src/components/help/help-center-content.tsx`.
- Inventory referenced: `docs/ui-renewal/11_WEB_APP_PAGES.md`, `docs/design-sync/01_DESIGN_SYSTEM_DELTA.md`.

---

## designSummary

- **Invitations.dc.html — "Share this move":** A single collaboration screen. Playfair title "Share this move" + sub "Plan together — everyone sees the same checklist." Then an **email input + gold "Invite" button** row, a full-width **"Share invite link"** secondary button (upload/link icon, gold text). A **MEMBERS** eyebrow section listing member rows (avatar disc w/ initials & per-member gradient, name "(you)", email, **role chip** Owner=gold / Editor=green / Viewer=slate). A **PENDING** eyebrow section with a dashed-border row (clock avatar, `jordan@email.com`, "Invited 2 days ago", amber **Pending** chip). Roles in the mock = **Owner / Editor / Viewer**.
- **Reminders.dc.html:** Playfair "Reminders" + count meta "{open} open · {done} done". A flat list **grouped into three urgency buckets** (Overdue red / This week amber / Upcoming teal), each header = colored dot + uppercase label + count. Each row = a **tappable checkbox** (toggles done with strike-through + 0.6 opacity), left accent bar in the bucket tone, title, "Due {date}" (red when overdue), and a muted **category pill** (Government/Utilities/Logistics/Finance). Local state toggles completion in-mock. No hero card.
- **Search.dc.html:** A top **search box** (gold-bordered, magnifier + input "Search services, tasks, addresses…" + ✕ clear). **Idle state** = a "TRY" eyebrow + wrap of **suggestion chips** (electric, USPS, DMV, internet, New York, utilities) that prefill the query. **Active state** = results grouped by domain (**Services / Tasks / Addresses / Providers / Guides**), each header "{group} · {n}", rows = emoji icon tile + title + sub + chevron. **No-results state** = 🔍 + "No results for "{q}"". No hero, no stat grid.
- **Help.dc.html — "Help & support":** Playfair "Help & support" + sub "We usually reply within a few hours." A **non-interactive search affordance** ("Search help articles…", placeholder only). A **POPULAR TOPICS** list (5 emoji rows: utilities, USPS mail forwarding, DMV, "How the Home Dossier data works", "Account, privacy & data export"). A **YOUR TICKETS** band (subject + status chip Open=amber / Resolved=green, "#id · updated {ago}"). A prominent gold-gradient **"Contact support"** CTA (message icon). Footer "**Move v2.1.0** · or email **hello@locateflow.com**".

## currentSummary

- **Invitations:** There is **no single "Share this move" screen**. Invite/manage lives inside web **`/settings/workspace`** (workspace selector, household rename, managed-sync consent, Members list with **role `<select>`**, Make-owner, Remove, transfer-ownership dialog, **Invite-a-member** form = email + role select + Invite, dev-invite-link box, pending-invites list with Revoke). Acceptance is a separate mobile screen `invitations/[token].tsx` and the cross-app `PendingInvitationsBanner`. Roles = **OWNER / ADMIN / MEMBER / CHILD / VIEW_ONLY** (not Owner/Editor/Viewer). No "Share invite link" / copy-link affordance — only emailed invites (+ dev URL).
- **Reminders:** Mobile `reminders/index.tsx` is a **richer** screen than the mock: header w/ back + "Reminders" + "{n} coming up", a **"REMINDER COMMAND" hero card** (next-up summary), a **4-stat chip grid** (Overdue/Soon/Renewal/Reminder), then the **same three urgency groups** (Overdue/Soon/Upcoming) with accent-bar rows. **Rows are NOT checkboxes** — they are navigational (tap → service/notification), with a "Due {date}" sub + muted category pill + chevron. Data = derived service renewals + reminder-shaped notification-feed rows. **Web has no `/reminders` route.**
- **Search:** Mobile `search.tsx` = back header + "SEARCH COMMAND" **hero card** + search box + an **8-domain stat chip grid** (Services/Addresses/Plans/Tasks/Budgets/Providers/Custom/Guides counts) + `SectionList` results across **8 domains**. **No "Try" suggestion chips**; idle state is an `EmptyState` prompt. Web search = a **⌘K command-palette modal** (`global-search.tsx`) over **pages + addresses + services only** (3 types), keyboard nav, no chips, no Tasks/Providers/Guides.
- **Help:** Mobile `help/index.tsx` = back header + heading + search input (functional, filters articles/FAQs) + **Popular topics (articles)** + a **Support tickets** row (→ `/help/tickets`) + **FAQ accordion** + gold-gradient "Contact support" CTA + footer "**LocateFlow v{version}**". Web help = `/help` (marketing or in-shell `HelpCenterContent`), branded "**LocateFlow** guides and FAQs". Mobile tickets list is a separate screen with create-modal + status pills.

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|---|---|---|---|---|---|---|
| app-surfaces-1 | rebrand | "LocateFlow" strings + email in Help/footers | Help.dc.html:49 footer "**Move v2.1.0** · or email **hello@locateflow.com**" | mobile `help/index.tsx:424` `LocateFlow v{version}`; web `help/page.tsx:16,32,37` "LocateFlow guides", metadata; banner header `X-Requested-With:"locateflow"` | High | Yes |
| app-surfaces-2 | theme | Navy/Gold vs current tokens (palette parity) | All 4 files: bg `#0A0F1C`, card `#121B2D`, Gold `#CBA45E/#DCBC7C`, border `rgba(110,150,225,.12)` | Mobile theme tokens (`@/lib/theme`); web `globals.css` Sapphire/Gold | Medium | No |
| app-surfaces-3 | missing | "Share this move" dedicated screen | Invitations.dc.html — title/sub + invite row + members + pending as ONE focused surface | No standalone screen; folded into `/settings/workspace/page.tsx`; mobile has only accept `invitations/[token].tsx` | High | Yes |
| app-surfaces-4 | missing | "Share invite link" / copy-link action | Invitations.dc.html:25 full-width "Share invite link" button (upload icon) | No copy/share-link affordance anywhere; only emailed invite (+ dev URL `workspace/page.tsx:712`) | High | Yes |
| app-surfaces-5 | different | Role taxonomy Owner/Editor/Viewer vs 5-role RBAC | Invitations.dc.html:55-57 roles **Owner / Editor / Viewer** w/ gold/green/slate chips | `workspace/page.tsx:51-57` **OWNER/ADMIN/MEMBER/CHILD/VIEW_ONLY**; assignable = ADMIN/MEMBER/CHILD/VIEW_ONLY | High | Yes |
| app-surfaces-6 | different | Members/Pending as styled cards vs functional rows | Invitations.dc.html:30-43 avatar discs + soft-bg role chips; dashed Pending card w/ "Invited 2 days ago" + amber chip | `workspace/page.tsx:604-662` plain divided rows (no avatar disc); pending list:719-739 = email + "pending" + Revoke (no time-ago, no dashed card) | Medium | No |
| app-surfaces-7 | missing | Reminders: tappable checkbox to complete | Reminders.dc.html:29-31,46-66 checkbox toggles done (strike-through, opacity, accent→green) | mobile `reminders/index.tsx:262-293` rows are **navigational only** — no complete/check action | Medium | Yes |
| app-surfaces-8 | different | Reminders header copy ("{open} open · {done} done") | Reminders.dc.html:19 `{openCount} open · {doneCount} done` | `reminders/index.tsx:305-307` `{n} coming up` (no open/done split; no done concept) | Low | No |
| app-surfaces-9 | new | Reminders bucket = "This week"; current = "Soon" | Reminders.dc.html:59 `week:{title:'This week'}` | `reminders/index.tsx:245` `week` label = "Soon" (`reminders.soon`) | Low | No |
| app-surfaces-10 | different | Reminders hero + stat grid are extra vs design | (design has neither hero nor stat chips — flat grouped list) | `reminders/index.tsx:328-381` "REMINDER COMMAND" HeroCard + 4-stat chip grid | Low | No |
| app-surfaces-11 | different | Reminders category pill source | Reminders.dc.html:33 per-task `cat` (Government/Utilities/Logistics/Finance) | `reminders/index.tsx:256-261` pill = Renewal/Contract/Reminder (kind), not service category | Low | No |
| app-surfaces-12 | missing | Web has no `/reminders` route | Reminders.dc.html is a first-class surface | Web: no `(app)/reminders` page; reminders only in `/notifications` + services attention strip (inventory 11_WEB_APP_PAGES.md §8) | Medium | Yes |
| app-surfaces-13 | missing | Search "Try" suggestion chips (idle state) | Search.dc.html:26-29,82 chips electric/USPS/DMV/internet/New York/utilities prefill query | mobile `search.tsx:524-529` idle = EmptyState prompt (no chips); web has none | Medium | No |
| app-surfaces-14 | different | Search domain set / grouping | Search.dc.html:80 order **Services/Tasks/Addresses/Providers/Guides** (5) | mobile `search.tsx:404-413` **8** domains (+Plans/Budgets/Custom); web `global-search.tsx` only **pages/addresses/services** (3) | Medium | Yes |
| app-surfaces-15 | different | Search result rows use emoji-tile icons | Search.dc.html:42 `{{i.icon}}` emoji (⚡💧📡🏠📰) in tile | mobile `search.tsx:573` lucide section icon in tile; web `global-search.tsx` lucide | Low | No |
| app-surfaces-16 | different | Search hero + stat chip grid extra vs design | (design = bare search box, no hero/stats) | mobile `search.tsx:459-519` "SEARCH COMMAND" hero + 8-domain count chip grid | Low | No |
| app-surfaces-17 | different | Web search = ⌘K modal vs full-page surface | Search.dc.html is a full standalone page | web `global-search.tsx` is a `createPortal` ⌘K modal triggered from header (no `/search` route) | Medium | Yes |
| app-surfaces-18 | different | Help search is functional vs placeholder | Help.dc.html:20-23 static "Search help articles…" affordance (no input) | mobile `help/index.tsx:312-321` real `TextInput` filtering articles+FAQs | Low | No |
| app-surfaces-19 | different | Help "Popular topics" topic set + Dossier topic | Help.dc.html:60-66 fixed 5 topics incl. "**How the Home Dossier data works**", "Account, privacy & data export" | mobile uses API/local **articles** (`help/index.tsx:128-153` getting-started/providers/moving); no Dossier/privacy topics | Medium | No |
| app-surfaces-20 | different | Help "Your tickets" inline band vs separate screen | Help.dc.html:36-46 inline tickets band (subject + Open/Resolved chip + "#id · updated") | mobile `help/index.tsx:358-369` single "Support tickets" row → `/help/tickets` separate list screen | Medium | No |
| app-surfaces-21 | different | Help FAQ accordion absent in design | (design has no FAQ accordion — topics + tickets + CTA only) | mobile `help/index.tsx:372-407` FAQ accordion section | Low | No |
| app-surfaces-22 | different | Help ticket status taxonomy | Help.dc.html:69-70 **Open / Resolved** | mobile tickets `tickets.tsx:40-47` **OPEN / IN_PROGRESS / WAITING_USER / CLOSED** | Low | No |
| app-surfaces-23 | new | Reminders done-state visual treatment | Reminders.dc.html:60-66 done = green check, strike-through, faint due, 0.6 opacity, neutral border | No equivalent (no completion concept in current reminders) | Low | No |
| app-surfaces-24 | different | Help version label hardcodes product name | Help.dc.html:49 "Move v2.1.0" | mobile pulls `Constants.expoConfig.version` but prefixes "LocateFlow" (`help/index.tsx:424`) | Low | Yes |

---

## Detail notes

### Invitations
- The design collapses **share + roster + pending** into one screen titled **"Share this move"** — a consumer, single-move framing. Current product models this as **household/workspace membership** under Settings, which is a different mental model (workspace, seat limits, plan gating, managed-sync). Reconciling these is a product decision (app-surfaces-3): keep the workspace settings page and add a lightweight "Share" entry, or rebuild as the mock shows.
- **Roles diverge materially** (app-surfaces-5). The mock's Owner/Editor/Viewer is 3 simple roles; the code has 5 RBAC roles with assignment rules (ADMIN only assignable by owner, CHILD, VIEW_ONLY). A rebrand cannot silently map these — needs a decision on whether the consumer surface relabels (e.g. MEMBER→Editor, VIEW_ONLY→Viewer) or the role model changes.
- **"Share invite link"** (app-surfaces-4) is a genuinely missing capability — current invites are email-only (a dev-only URL box exists at `workspace/page.tsx:712` but is gated on no-email-configured, not a user share action). Adding a shareable/copyable link is net-new product + backend work (token exposure), hence decisionNeeded.
- Pending row in the mock shows **"Invited 2 days ago"** + amber chip in a **dashed** card; current pending list shows only `email · pending · Revoke` with no relative time and no dashed styling (app-surfaces-6).

### Reminders
- Biggest interaction gap: the mock's rows are **completable checkboxes** (app-surfaces-7) with a satisfying done state (app-surfaces-23). Current reminders are read/navigate-only because they are **derived** (service renewals + notification-feed rows) with no per-row "done" persistence — making them checkable implies a backend completion model (decisionNeeded).
- Current mobile screen is otherwise **richer** than the mock (adds a hero + stat grid, app-surfaces-10) — a reskin should decide whether to keep those or match the mock's flatter list.
- **No web reminders surface** at all (app-surfaces-12): if Reminders is meant to be cross-platform per the handoff, web needs a new `/reminders` route (today it is split across `/notifications` and the services attention strip).

### Search
- The mock's idle **"Try" chips** (app-surfaces-13) are a small but visible UX affordance absent on both platforms.
- **Domain mismatch is three-way** (app-surfaces-14): design = 5 domains, mobile = 8, web = 3. Web's ⌘K palette is by far the thinnest (pages/addresses/services only) and does not cover Tasks/Providers/Guides shown in the design. Whether web gets a full search surface vs keeps the palette is a decision (app-surfaces-17).
- Mock uses **emoji tile icons** per result (app-surfaces-15) vs lucide today — cosmetic, fold into the icon-system decision.

### Help
- **Brand/footer strings** are the clearest rebrand hits (app-surfaces-1, -24): mobile footer says "LocateFlow v{version}"; the mock says "Move v2.1.0". Note the mock's footer email is **`hello@locateflow.com`** — i.e. the design still references the old domain, so the rebrand source itself is inconsistent here; the team must pick the canonical product name + support email.
- Mock's **Popular topics** are a curated fixed set including **"How the Home Dossier data works"** and **"Account, privacy & data export"** (app-surfaces-19) — these map to real features but are not in the current article set (getting-started/providers/moving). Curating help topics to match is content work.
- Mock shows tickets **inline** (app-surfaces-20) and has **no FAQ accordion** (app-surfaces-21); current mobile separates tickets to `/help/tickets` and adds a FAQ accordion. A reskin must decide the information architecture (inline tickets band vs drill-in; keep/drop FAQ accordion).
- Ticket **status vocab differs** (app-surfaces-22): Open/Resolved (mock) vs OPEN/IN_PROGRESS/WAITING_USER/CLOSED (code).

## Open questions (carried into StructuredOutput)
1. Is "Share this move" a new dedicated consumer screen, or does the existing `/settings/workspace` page get re-skinned + a Share entry? (app-surfaces-3)
2. Adopt the simplified Owner/Editor/Viewer role labels, or keep the 5-role RBAC and only relabel the consumer view? (app-surfaces-5)
3. Build a shareable/copyable invite link (token exposure + backend) to satisfy "Share invite link"? (app-surfaces-4)
4. Make reminders completable (needs a per-reminder done model/persistence), or keep them derived/read-only? (app-surfaces-7)
5. Should web gain a `/reminders` route and/or a full search surface, or keep notifications + ⌘K palette? (app-surfaces-12, -17)
6. Canonical product name + support email — mock mixes "Move" with `hello@locateflow.com`. (app-surfaces-1, -24)
7. Search domain coverage: align all platforms to one domain set (design=5, mobile=8, web=3)? (app-surfaces-14)
</content>
</invoke>
