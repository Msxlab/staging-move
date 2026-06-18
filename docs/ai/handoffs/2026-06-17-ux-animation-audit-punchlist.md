# UX / UI / Animation Audit — Prioritized Punch-List (2026-06-17)

Read-only audit across web + mobile (6 parallel reviewers) of the just-reshaped pricing / free-tier preview /
trial / Move Command Center / Home Dossier surfaces. Color-contrast was OUT OF SCOPE (already fixed in a
separate PR). Items are deduplicated and grouped into proposed Codex polish batches, highest impact first.

**Overall:** motion discipline is genuinely good — reduce-motion gating is near-universal, mobile reanimated is
solid (settled poses, cancelAnimation on unmount), the hero/dossier/aurora pieces are well-built. The problems
are concentrated and fixable. The single biggest theme: **several polished animations never actually play**
(the long-standing "animations not visible" report is partly REAL, not just a stale device build).

Each item: `severity · effort · what's wrong → fix · files`.

---

> **STATUS (2026-06-17 — Claude implementing directly):** Branch `claude/ux-polish` (rebased on main after
> #283/#284/#285; 8 commits; typecheck green each; pushed). DONE:
> • **Batch A** — reduce-motion (reveal blank-text #1, app-wide skeleton gating #3, ring+bars #4, pulse dot #7),
>   mobile AnimatedSplash rewrite #5, milestone glow + command-center CountUp #6, DossierAmbient seed #6.
>   **Item #2 (ListEntrance/CountUp "unwired") was a FALSE POSITIVE** — both were already wired in `app/`
>   (the reviewer searched only `src/`). Genuine "not visible" cause = #1 blank-text + (likely) a stale device
>   build. Remedy on device = OTA/rebuild.
> • **Batch B** — CTA asChild on conversion surfaces #8 (lower-traffic pages delegated to Codex, separate PR),
>   ring/Up-Next aria #13, billing toggle → segmented group #10, accessible mobile nav #9, dossier teaser
>   trim + 44px CTA (#31 + tap-target).
> • **Batch C** — DashboardSkeleton reflow #17, auth blank-flash fallback #20, onboarding hydration gate #18
>   (hydrated flag set in loadOnboardingState's finally → wizard skeleton until resolved).
> • **A11y extras** — Android KeyboardAvoidingView Platform.select #29, more 44px tap targets #11.
> 10 commits total (`d7449ef2`…`8fe5aa6a`), each typecheck-green, pushed.
> DELIBERATELY DEFERRED (need live app or are aesthetic/low-value — not safe/worth blind-editing):
> command-center recommendations race #19 (real fix = data orchestration, risks slowing the dashboard;
> verify live), heading font hierarchy #16 (Fraunces-vs-Geist aesthetic judgment), mobile subscription
> cycle toggle #27 + upsell-card consolidation #34 (UX build / refactor), confetti tokens #30 (would dull
> the light theme), hover-on-touch, sign-up password-strength meter. Finish these against the live app
> after merge + redeploy/OTA.

## Batch A — Make animations actually play + reduce-motion correctness (the "not visible" root cause)

1. **Reveal upgrade modal blank for ~1s under reduce-motion** — HIGH · S. The reduce-motion block resets
   `animation-duration` but NOT `animation-delay`; with `fill-mode: backwards` the headline + subhead + BOTH CTA
   buttons hold opacity:0 for up to 1s on the upgrade celebration — invisible AND unclickable for reduce-motion
   users. Fix: add `animation:none;opacity:1;transform:none` for `.reveal-eyebrow/.reveal-title/.reveal-sub/.reveal-actions`
   (+ reset `.reveal-confetti` delay) in the reduce-motion block — mirror the `ob-*` block that already does this.
   Files: `apps/web/src/styles/globals.css`, `apps/web/src/components/premium/reveal-modal.tsx`.
2. **ListEntrance + CountUp wiring — ❌ FALSE POSITIVE (verified already wired).** The motion-system reviewer
   searched only `apps/mobile/src/` and missed `apps/mobile/app/`: `ListEntrance` IS wrapped per-row in
   `(tabs)/addresses.tsx`, `(tabs)/services.tsx`, and `notifications/index.tsx`; `CountUp` IS used in the
   `(tabs)/index.tsx` dashboard stat cards (the exact place the audit said to wire it) and 5× in `budget/index.tsx`.
   No list/stat wiring was needed. DONE anyway as a small bonus: `CountUp` wired into the mobile command-center
   readiness % (was plain `Text`), for parity with the ring sweep + the dashboard cards.
3. **App-wide skeletons pulse under reduce-motion** — HIGH · S. `loading-state.tsx` (~30 uses) + `ui/skeleton.tsx`
   use raw `animate-pulse` (not gated; Tailwind pulse is NOT auto-disabled). Dossier already uses
   `motion-safe:animate-pulse` — apply that pattern. Files: `apps/web/src/components/shared/loading-state.tsx`,
   `apps/web/src/components/ui/skeleton.tsx`.
4. **Web readiness ring + progress bars animate under reduce-motion** — MED · S. `transition-all duration-700`
   on the ring `<circle>` + moving/spending/category bars, no `motion-reduce:transition-none` (the sibling chevron
   already has it). Scope to `transition-[stroke-dasharray]` + gate. File: `move-command-center.tsx`, `dashboard-client.tsx`.
5. **Mobile AnimatedSplash off-system** — HIGH · M. Legacy `Animated` API, no reduce-motion gate, JS-thread `width`
   animation (stutters during boot), forced ~860ms+ delay adds launch latency. Gate behind reduce-motion, animate
   `scaleX` on native driver, fire `onFinish` when ready + minimal brand-hold. File: `apps/mobile/src/components/AnimatedSplash.tsx`.
6. **Mobile milestone "glow" computed but not rendered; DossierAmbient mount-fragile** — LOW · S. `pop` only drives
   a +0.03 scale (no glow despite docstring); DossierAmbient renders nothing until onLayout reports non-zero size.
   Render a settled frame immediately + make the milestone visible. Files: `MoveCommandCenter.tsx`, `DossierAmbient.tsx`.
7. **Landing `animate-pulse` dot ungated** — LOW · S. `page.tsx:528`. Gate it, or add a global reduce-motion guard
   for Tailwind `animate-*` utilities. Files: `apps/web/src/app/page.tsx`, `globals.css`.

## Batch B — Accessibility & semantics

8. **Every web CTA = `<Link><Button>` → invalid `<a><button>`** — HIGH · M. Breaks focus ring + keyboard semantics
   on nearly every conversion CTA. Fix: `<Button asChild><Link/></Button>` (already supported). Files: `page.tsx`,
   `pricing-section.tsx`, `workspace-plans-section.tsx`, `dossier-showcase.tsx`, `ui/button.tsx`.
9. **Marketing header has no mobile nav** — HIGH · M. Nav is `hidden md:flex`, no hamburger; Pricing/Features/etc
   unreachable on phones (dominant traffic). Add a disclosure/sheet menu with proper aria + ≥44px trigger.
   File: `apps/web/src/components/marketing/marketing-header.tsx`.
10. **Billing toggle a11y broken** — HIGH · M. `role=tablist` with no arrow-key/roving-tabindex + one panel for two
    tabs (broken aria-controls). Simplest honest fix: convert to `role=radiogroup`/segmented control.
    File: `pricing-section.tsx`.
11. **Sub-44px tap targets on the upgrade path** — HIGH · S/M. Billing toggle (~36px), dossier/teaser CTAs (~38px),
    text-only "Unlock" links (~16px), onboarding skip/coach×/provider-remove chips, mobile sheet close (X@14),
    mobile `Button size_sm` (~29px). Enforce 44px min / hitSlop. Files: `pricing-section.tsx`, `home-dossier.tsx`,
    `ob-cta.tsx`, `onboarding-client.tsx`, `mobile (tabs)/index.tsx`, `mobile Button.tsx`.
12. **Upsell CTA hand-rolled 3× (`bg-tone-orange-fg text-white`)** — HIGH · M. Drifting focus/hover/press, lost
    focus ring. Promote to shared `Button` variant. Files: `move-command-center.tsx`, `home-dossier.tsx`, `ui/button.tsx`.
13. **Readiness ring / Up Next completion silent to screen readers** — MED · S. Ring is `role=img` (not live); undo
    bar has no `role=status`. Mark inner `%` `aria-hidden` (double-read), wrap detail line in `aria-live=polite`,
    give undo bar `role=status`. Files: `move-command-center.tsx`, `up-next.tsx`.
14. **Onboarding: no autofocus per step; error banner not scrolled/focused on validation fail** — MED · S. Silent-
    failure drop-off. Move focus to step heading/first invalid field + scrollIntoView; add inline field errors +
    aria-live step announcements. File: `onboarding-client.tsx`.
15. **Mobile step indicator is color-only below sm; compound rows drop context from a11y tree** — MED · S. Always
    show "Step X of 4 · label" + `aria-current`; compose accessibilityLabel with eyebrow+name+deadline; ring
    `accessibilityRole=progressbar`. Files: `onboarding-client.tsx`, `aurora-aside.tsx`, mobile `(tabs)/index.tsx`.
16. **Heading hierarchy inconsistent** — MED · M. Command-center hero `h2 text-3xl` raw vs dossier `h3 .h2` Fraunces;
    level skips; variant heroes emit `h2` blindly. Standardize on the `.h1/.h2/.h3` helpers + level-aware headings.
    Files: `move-command-center.tsx`, `home-dossier.tsx`, `pricing-section.tsx`.

## Batch C — Perceived performance & loading/empty/error states

17. **DashboardSkeleton doesn't match real layout → full-page reflow (CLS)** — HIGH · M. Skeleton has no hero +
    wrong stats column count. Rebuild to mirror hero (reserve height) + 3-col grid. Files: `loading-state.tsx`,
    `dashboard-client.tsx`.
18. **Onboarding hydration snap** — HIGH · M. Empty Step 0 renders, then jumps to resolved step + back-fills fields
    (looks like data lost). Add a `hydrated` gate + skeleton. File: `onboarding-client.tsx`.
19. **Command-center hero renders before recommendations load → ring flashes low % then jumps; CTA pops in** —
    MED · M. Fold `fetchRecommendations` into the initial load, or skeleton the ring/CTA + reserve min-height.
    Files: `dashboard-client.tsx`, `move-command-center.tsx`.
20. **Auth pages flash blank (`Suspense fallback={null}`)** — MED · S. Replace with a card-shaped skeleton.
    Files: `sign-in/page.tsx`, `sign-up/page.tsx`.
21. **Embedded checkout: thin loading/error, no spinner, error not announced** — MED · S. Add spinner + iframe
    skeleton + wrap error in `role=alert` (payment moment). File: `embedded-checkout-card.tsx`.
22. **Free-tier surfaces: uneven skeleton + missing empty/error states** — MED · M. Command center has no skeleton
    while dossier does; free-preview card can render header-only if steps empty. Add command-center skeleton +
    guaranteed fallback row. Files: `move-command-center.tsx`, `dashboard-client.tsx`, `onboarding-client.tsx`.

## Batch D — Motion polish & consistency

23. **No scroll-entrance motion on long landing** — MED · M. `reveal-fade-up` keyframe exists but unused → flat
    after the hero. Add IntersectionObserver reveals (opacity+translateY, staggered, motion-safe). Files: `page.tsx`,
    `globals.css`, marketing sections.
24. **Plan compare table: mobile horizontal scroll, no affordance, not keyboard-focusable** — MED · M. Add
    `role=region`+`aria-label`+`tabindex=0` + edge-fade + sticky label column (or stacked layout < sm).
    File: `plan-compare-table.tsx`.
25. **Pricing toggle/cards motionless** — MED · M. Prices snap on cycle change (no crossfade/count); cards no
    entrance/hover. Add ~240ms crossfade/count + motion-safe hover lift + first-view fade-up. File: `pricing-section.tsx`.
26. **No shared motion-token set** — MED · M. 24 ad-hoc durations + ~12 spring configs; web/mobile divergence
    (count-up 600 vs 800ms, ring 650 vs 700ms). Add shared `{duration, spring, easing}` tokens; align the two
    platforms. Files: `packages/shared/src`, `mobile theme.ts`, web `globals.css`.
27. **Mobile subscription screen: long unsegmented scroll, no monthly/annual toggle, compare accordion snaps** —
    MED · S/L. Add a segmented cycle toggle (web parity), LayoutAnimation on the accordion (reduce-motion gated).
    File: `apps/mobile/app/settings/subscription.tsx`.
28. **Mobile high-intent CTAs bypass usePressScale** — MED · M. Upsell/teaser/upgrade/manage buttons are raw
    TouchableOpacity (flattest feel on the most important buttons). Route through shared `Button` / `usePressScale`.
    Files: `FreeMoveUpsellCard.tsx`, `MoveTeaserCard.tsx`, `HomeDossierCard.tsx`, `subscription.tsx`.
29. **Mobile KeyboardAvoidingView `behavior="padding"` unconditional** — MED · S. Wrong on Android (fields hidden).
    `Platform.select({ios:'padding',android:undefined})`. File: `apps/mobile/app/onboarding.tsx`.
30. **Confetti hardcoded hex + duration mismatch with shared keyframe** — LOW · S. Drive colors from tokens; align
    1400ms with the keyframe. Files: `move-command-center.tsx`, `globals.css`.
31. **Home Dossier teaser: 9 near-identical locked rows (more wall than tease)** — LOW · S. Trim to 3–4 + "+5 more".
    File: `home-dossier.tsx`.
32. **Free-preview teaser has no "Edit move details" exit on the free path** — MED · S. Mistyped move = dead end /
    feels bait-and-switch. Add `setTeaser(null)` back affordance (paid branch already has it). File: `onboarding-client.tsx`.
33. **Collapsed-by-default widgets hide content behind unlabeled strips** — LOW · M. Add a one-line value peek per
    collapsed strip. File: `dashboard-client.tsx`.
34. **Component/token consistency** — LOW · S each. Mobile upsell/teaser cards are copy-paste cousins (extract shell);
    CountUp lacks `tabular-nums` (layout shift); OAuth buttons hardcode palette + duplicated; mobile FreeMoveUpsellCard
    hardcodes rgba literals + off-scale padding; sign-up has no inline password-strength feedback (minLength=12).

---

## Suggested execution order
A (animations actually play + reduce-motion) → B (a11y/semantics) → C (perceived perf/states) → D (polish/consistency).
Batch A is highest leverage: it directly resolves the long-standing "animations not visible" report AND closes the
biggest reduce-motion gaps, mostly with small edits. Land each batch as its own PR; verify reduce-motion + dark mode
+ no regressions after each.
