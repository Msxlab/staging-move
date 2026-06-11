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

/**
 * New Home Dossier shape for the Pro PDF export. Mirrors the section payload
 * returned by GET /api/addresses/:id/dossier (the entitled branch) so the PDF
 * generator and the data route stay aligned — the route is the single source
 * of the aggregation; the PDF only renders what it returns.
 */
export type PdfDossier = {
  address: { id: string; city: string; state: string };
  flood: { status: string; zone: string | null; isHighRisk: boolean | null };
  school: { status: string; districtName: string | null; ncesId: string | null };
  weather: {
    status: string;
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  };
  hazards: { status: string; topRisks: Array<{ hazard: string; rating: string }>; overallRating: string | null };
  radon: { status: string; zone: string | null };
  water: { status: string; systemName: string | null; violations5y: number | null };
  air: { status: string; aqi: number | null; category: string | null };
  /**
   * Pro "Neighborhood Intelligence" (Census ACS area medians). Present on Pro
   * payloads — the only tier that reaches this PDF (dossierPdf gate). Optional
   * so older/degraded payloads still render. Figures are area medians for the
   * surrounding census tract, NOT a valuation of this specific home.
   */
  neighborhood?: {
    status: string;
    medianHomeValue: number | null;
    medianGrossRent: number | null;
    medianHouseholdIncome: number | null;
    ownerOccupiedPct: number | null;
    walkScore?: number | null;
    walkBand?: string | null;
    schools?: Array<{ name: string; level: string | null }> | null;
  };
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
