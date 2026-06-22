# Adversarial Verification — marketing-seo-content-04

## Finding under review
- **ID:** marketing-seo-content-04
- **Claimed severity:** High
- **Title:** Unsourced "4.9 on the App Store" rating hard-coded in homepage hero
- **Category:** Logic
- **Claimed evidence:** `apps/web/src/app/page.tsx:249` renders a trust chip literally "4.9 on the App Store" with no data source, config value, or attribution. HardStats requires every stat to cite a real public source.

## Verdict: CONFIRMED

I attempted to refute this finding by reading the cited source directly. The code clearly supports the claim.

## What the code actually shows

### 1. The chip exists exactly as described
`apps/web/src/app/page.tsx` lines 246-259 render a row of three trust chips in the hero:

```
246  <div className="flex flex-wrap gap-x-6 gap-y-2 ...">
247    <span className="flex items-center gap-1.5">
248      <CheckCircle2 className="h-3 w-3 text-success" />
249      4.9 on the App Store
250    </span>
251    <span className="flex items-center gap-1.5">
252      <CheckCircle2 className="h-3 w-3 text-success" />
253      FEMA, EPA and NWS data
254    </span>
255    <span className="flex items-center gap-1.5">
256      <CheckCircle2 className="h-3 w-3 text-success" />
257      Web, iOS and Android
258    </span>
259  </div>
```

The string `4.9 on the App Store` at line 249 is a hardcoded literal. It is not gated behind any feature flag (unlike the connector and workspace sections at lines 412 and 444), is not driven by any config/constant/prop, has no `<sup>`/asterisk/source annotation, and is rendered with a success checkmark that visually presents it as a verified fact. It renders for every visitor (the page is `export const dynamic = "force-dynamic"`).

### 2. The codebase's own convention requires sourcing for such claims
`apps/web/src/components/marketing/hard-stats.tsx` lines 3-8 and 13-17 confirm the project's stated standard:

```
3  /**
4   * Hard stats — the credibility play.
...
7   * to "is real". Each card cites a real public source. Don't add stats
8   * here without an attributable source ...
```

Every stat object carries a `sourceKey` (lines 14-16) that renders an attribution line (lines 42-44). The App Store rating chip carries no such attribution, contradicting the codebase's own convention for quantitative credibility claims.

### 3. The team already treats this exact class of claim as a compliance risk
The same file, lines 479-483, documents the removal of a fabricated named testimonial:

```
479  /* NOTE: The standalone <TestimonialQuote/> pull-quote was removed because
480     it shipped a FABRICATED named-customer attribution (...) live and ungated
481     — an FTC/endorsement risk. ... */
```

`SocialProof` (line 477) is likewise flagged as SAMPLE/placeholder content pending real attributable quotes. This establishes that unsourced/unverified quantitative trust signals are recognized by the team as an FTC/endorsement-claim risk. The "4.9 on the App Store" chip is the same category of claim — a specific numeric rating presented as fact — yet it remains live, ungated, and unsourced.

## Distinction worth noting (does not change verdict)
The two sibling chips are materially different in kind:
- `FEMA, EPA and NWS data` and `Web, iOS and Android` are descriptive/factual statements about the product's data sources and platforms, verifiable from the product itself.
- `4.9 on the App Store` is a specific quantitative endorsement metric with no in-repo source, no config, and (per the marketing-side notes about limited release / sample testimonials) plausibly not yet backed by a real public app-store rating.

This reinforces, rather than weakens, the finding: the rating is the only chip making an unsubstantiated numeric claim.

## Impact
An unsubstantiated, specific app-store rating shown to every visitor is an FTC/endorsement-claim risk. If the real rating differs, or the app is still in limited release (the file's own notes about placeholder testimonials suggest pre-launch posture), this misrepresents the product to every visitor and erodes trust.

## Recommendation
Either (a) remove the chip, (b) gate it behind a flag and drive the value from a real, attributable source (config or API) with a visible source label consistent with the HardStats convention, or (c) replace it with a descriptive, verifiable claim until a genuine rating exists.

## Severity assessment
Original severity **High**. The risk is real (compliance/trust) and ungated/live to all visitors. However, it is a single static string with no data-integrity, security, or functional impact, and the remediation is trivial. It is comparable to the removed fabricated-testimonial issue the team already classed as an FTC risk. I assess **Medium** as the more proportionate severity for a single unsourced marketing claim, while noting the finding itself is fully confirmed. Reasonable reviewers could keep it at High given the explicit FTC/endorsement framing the team itself uses for sibling claims.

## Related files
- `apps/web/src/app/page.tsx` (line 249)
- `apps/web/src/components/marketing/hard-stats.tsx` (convention reference)
- `apps/web/src/components/marketing/social-proof.tsx` (sibling placeholder-content handling)
