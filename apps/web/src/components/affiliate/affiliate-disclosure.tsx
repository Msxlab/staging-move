/**
 * FTC material-connection disclosure for affiliate "Get started" CTAs
 * (docs/ai/free-pivot/19 §8). LocateFlow may earn a commission on some sign-ups;
 * the law requires a clear, conspicuous disclosure near the link. The copy also
 * states the ranking-integrity promise (§7): affiliate economics never affect
 * organic order.
 *
 * SHORT is used as the per-CTA `title`/tooltip (adjacent to every button);
 * <AffiliateDisclosure /> renders the visible, conspicuous line on each surface
 * that shows affiliate CTAs.
 */
export const AFFILIATE_DISCLOSURE_SHORT =
  "Affiliate link — we may earn a commission if you sign up, at no extra cost to you.";

export const AFFILIATE_DISCLOSURE_LONG =
  "Some “Get started” links are affiliate links: LocateFlow may earn a commission if you start service through them, at no extra cost to you. This never affects our rankings.";

export function AffiliateDisclosure({ className }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-muted-foreground ${className ?? ""}`}>
      {AFFILIATE_DISCLOSURE_LONG}
    </p>
  );
}
