function firstFiniteUnix(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function periodShape(subscription: unknown) {
  return subscription as
    | {
        current_period_end?: unknown;
        current_period_start?: unknown;
        items?: {
          data?: Array<{
            current_period_end?: unknown;
            current_period_start?: unknown;
          }>;
        };
      }
    | null
    | undefined;
}

export function getStripeSubscriptionCurrentPeriodEndUnix(
  subscription: unknown,
): number | null {
  const shaped = periodShape(subscription);
  return (
    firstFiniteUnix(shaped?.current_period_end) ||
    firstFiniteUnix(shaped?.items?.data?.[0]?.current_period_end)
  );
}

export function getStripeSubscriptionCurrentPeriodStartUnix(
  subscription: unknown,
): number | null {
  const shaped = periodShape(subscription);
  return (
    firstFiniteUnix(shaped?.current_period_start) ||
    firstFiniteUnix(shaped?.items?.data?.[0]?.current_period_start)
  );
}

export function getStripeSubscriptionCurrentPeriodEndDate(
  subscription: unknown,
): Date | null {
  const unix = getStripeSubscriptionCurrentPeriodEndUnix(subscription);
  return unix ? new Date(unix * 1000) : null;
}
