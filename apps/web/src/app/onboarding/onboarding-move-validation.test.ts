import { describe, expect, it, vi } from "vitest";

// `onboarding-client.tsx` is a heavy client module; we only need its pure,
// exported destination helpers. Stub the client-only / side-effectful imports
// so the module loads under the Node test environment.
// Only the icons imported directly by onboarding-client.tsx are needed once the
// heavy child components (which pull their own icons) are stubbed below.
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    __esModule: true,
    default: Icon,
    User: Icon, MapPin: Icon, Zap: Icon, Truck: Icon, CheckCircle2: Icon,
    AlertCircle: Icon, Loader2: Icon, Globe: Icon, Phone: Icon, Search: Icon,
    Building2: Icon, Shield: Icon, X: Icon, ChevronDown: Icon, ChevronUp: Icon,
    Sparkles: Icon, Calendar: Icon, Lock: Icon, CalendarClock: Icon, Clock: Icon,
    Briefcase: Icon, Palmtree: Icon,
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en-US",
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

// Stub the heavy child components/illustrations so their own (transitive)
// lucide-react and other client-only imports never load. The destination
// helpers under test do not touch any of them.
vi.mock("./aurora-aside", () => ({ AuroraAside: () => null }));
vi.mock("@/components/onboarding/ob-cta", () => ({ ObCta: () => null }));
vi.mock("@/components/onboarding/ob-coach", () => ({
  ObCoach: () => null,
  COACH_STEP_COPY_KEYS: {},
  useCoachCollapsed: () => [false, () => {}],
}));
vi.mock("@/components/onboarding/ob-pro-showcase", () => ({
  ObProShowcase: () => null,
  selectProShowcaseFeatures: () => [],
  hasProShowcaseContext: () => false,
}));
vi.mock("@/components/illustrations/RaccoonReading", () => ({ RaccoonReading: () => null }));
vi.mock("@/components/illustrations/RaccoonMark", () => ({ RaccoonMark: () => null }));
vi.mock("@/components/address/address-autocomplete-input", () => ({
  AddressAutocompleteInput: () => null,
}));
vi.mock("@/components/ui/category-icon", () => ({ CategoryIcon: () => null }));
vi.mock("@/components/legal/legal-consent-panel", () => ({ LegalConsentPanel: () => null }));
vi.mock("@/components/shared/service-limit-upsell", () => ({
  ServiceLimitUpsell: () => null,
}));

import {
  deriveMovingDestinationFields,
  parseUsAddressString,
} from "./onboarding-client";

describe("onboarding move destination derivation (onboarding-move-validation)", () => {
  // Mirrors the inline check in validateMovingForm so the regression covers the
  // actual gate, not just the helper.
  const destinationComplete = (form: {
    street: string;
    city: string;
    state: string;
    zip: string;
    formattedAddress?: string | null;
  }) => {
    const { city, state, zip } = deriveMovingDestinationFields(form);
    return Boolean(city && state && zip) && state.length === 2;
  };

  it("passes when the three discrete City/State/ZIP fields are filled manually", () => {
    expect(
      destinationComplete({
        street: "123 New St",
        city: "Mountain View",
        state: "CA",
        zip: "94043",
      }),
    ).toBe(true);
  });

  it("REGRESSION: a Places selection that only left a formatted address still validates", () => {
    // Reproduces the P1: the autocomplete selection populated the Street /
    // formattedAddress but the discrete City/State/ZIP boxes were never
    // written (e.g. Places details unavailable). Pre-fix this returned false
    // and the form blocked with "Please fill in destination city, state, ZIP…".
    const form = {
      street: "1600 Amphitheatre Pkwy",
      city: "",
      state: "",
      zip: "",
      formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
    };
    expect(destinationComplete(form)).toBe(true);

    const derived = deriveMovingDestinationFields(form);
    expect(derived).toEqual({ city: "Mountain View", state: "CA", zip: "94043" });
  });

  it("REGRESSION: a full address typed into the Street field still validates", () => {
    const form = {
      street: "1600 Amphitheatre Pkwy, Mountain View, CA 94043",
      city: "",
      state: "",
      zip: "",
    };
    expect(destinationComplete(form)).toBe(true);
    expect(deriveMovingDestinationFields(form)).toEqual({
      city: "Mountain View",
      state: "CA",
      zip: "94043",
    });
  });

  it("does not overwrite discrete fields the user already supplied", () => {
    const derived = deriveMovingDestinationFields({
      street: "1 Castro St, Austin, TX 78701",
      city: "Mountain View",
      state: "CA",
      zip: "94043",
    });
    expect(derived).toEqual({ city: "Mountain View", state: "CA", zip: "94043" });
  });

  it("still reports incomplete when no destination is provided at all", () => {
    expect(
      destinationComplete({ street: "", city: "", state: "", zip: "" }),
    ).toBe(false);
  });

  it("parses common US address shapes", () => {
    expect(parseUsAddressString("Mountain View, CA 94043")).toMatchObject({
      city: "Mountain View",
      state: "CA",
      zip: "94043",
    });
    expect(parseUsAddressString("Mountain View CA 94043")).toMatchObject({
      city: "Mountain View",
      state: "CA",
      zip: "94043",
    });
    expect(parseUsAddressString("")).toEqual({});
  });
});
