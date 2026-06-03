export function shouldEmphasizeAnnualBilledPrice(opts: {
  showAnnualAction: boolean;
  yearlyDisplayPrice: string | null | undefined;
  trialBadge: string | null | undefined;
  savingsText: string | null | undefined;
}) {
  return opts.showAnnualAction &&
    Boolean(opts.yearlyDisplayPrice) &&
    Boolean(opts.trialBadge || opts.savingsText);
}

export function getAnnualActionLabels(opts: {
  yearlyDisplayPrice: string;
  isSwitching: boolean;
  trialBadge?: string | null;
  startLabel?: string | null;
  switchLabel?: string | null;
}) {
  const prefix = opts.isSwitching
    ? (opts.switchLabel || "Switch to annual")
    : (opts.startLabel || "Start annual");

  return {
    buttonLabel: `${prefix} · ${opts.yearlyDisplayPrice}`,
    metaText: opts.trialBadge || null,
  };
}
