/**
 * Shared types for the server-side PDF generators.
 *
 * Both the per-address monthly expense report and the full-account export
 * read from the same domain shapes — keep them in one place so the API
 * route, the generators, and any future integrations stay aligned.
 */

export type PdfAddressService = {
  id: string;
  providerName: string;
  category: string;
  monthlyCost: number;
  billingDay?: number | null;
};

export type PdfAddress = {
  id: string;
  type: string;
  nickname?: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  ownership: string;
  startDate: string | Date;
  services: PdfAddressService[];
};

export type PdfAccountSnapshot = {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    preferredLocale?: string | null;
    createdAt: string | Date;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEndsAt: string | Date | null;
  } | null;
  addresses: PdfAddress[];
  movingPlans: Array<{
    moveDate: string | Date | null;
    status: string;
    fromCity?: string | null;
    fromState?: string | null;
    toCity?: string | null;
    toState?: string | null;
  }>;
  taskSummary: {
    open: number;
    completed: number;
    dismissed: number;
  };
};
