export type ProviderCoverageModel = "state" | "zip_prefix" | "polygon" | "live_address";

export interface ProviderCoveragePoint {
  latitude: number;
  longitude: number;
}

export interface ProviderCoveragePolygon {
  label: string;
  points: ProviderCoveragePoint[];
}

export interface ProviderCoverageMetadata {
  slug: string;
  coverageModel: ProviderCoverageModel;
  officialUrl: string;
  note: string;
  source: "catalog" | "research";
  polygons?: ProviderCoveragePolygon[];
}

function polygon(label: string, coordinates: Array<[number, number]>): ProviderCoveragePolygon {
  return {
    label,
    points: coordinates.map(([latitude, longitude]) => ({ latitude, longitude })),
  };
}

function rectangle(
  label: string,
  north: number,
  west: number,
  south: number,
  east: number
): ProviderCoveragePolygon {
  return polygon(label, [
    [north, west],
    [north, east],
    [south, east],
    [south, west],
  ]);
}

const CURATED_RESEARCH_MODELS: ProviderCoverageMetadata[] = [
  {
    slug: "xfinity",
    coverageModel: "live_address",
    officialUrl: "https://www.xfinity.com",
    note: "Availability is confirmed by address rather than a stable public ZIP territory list.",
    source: "research",
  },
  {
    slug: "att-fiber",
    coverageModel: "live_address",
    officialUrl: "https://www.att.com/internet/availability/",
    note: "AT&T Fiber serviceability is address-qualified on the official availability checker.",
    source: "research",
  },
  {
    slug: "verizon-fios",
    coverageModel: "live_address",
    officialUrl: "https://www.verizon.com/coverage-map/",
    note: "Verizon Fios availability is exposed as an address-level coverage check.",
    source: "research",
  },
  {
    slug: "frontier",
    coverageModel: "live_address",
    officialUrl: "https://frontier.com/local",
    note: "Frontier serviceability varies by address and local buildout.",
    source: "research",
  },
  {
    slug: "google-fiber",
    coverageModel: "live_address",
    officialUrl: "https://fiber.google.com",
    note: "Google Fiber availability is city and address specific.",
    source: "research",
  },
  {
    slug: "gci-ak",
    coverageModel: "live_address",
    officialUrl: "https://www.gci.com/business/support/coverage-map",
    note: "GCI coverage is ultimately address-qualified across Alaska markets.",
    source: "research",
  },
  {
    slug: "bart",
    coverageModel: "polygon",
    officialUrl: "https://www.bart.gov/system-map",
    note: "BART should match corridor and station geography rather than broad California state scope.",
    source: "research",
    polygons: [
      polygon("BART core district corridor", [
        [38.06, -122.53],
        [38.06, -121.23],
        [37.92, -121.18],
        [37.35, -121.73],
        [37.09, -121.94],
        [37.1, -122.31],
        [37.78, -122.55],
      ]),
    ],
  },
  {
    slug: "caltrain",
    coverageModel: "polygon",
    officialUrl: "https://www.caltrain.com",
    note: "Caltrain is a Bay Peninsula corridor provider and needs route-aware matching.",
    source: "research",
    polygons: [
      polygon("Caltrain peninsula rail corridor", [
        [37.81, -122.52],
        [37.8, -122.39],
        [37.71, -122.31],
        [37.58, -122.27],
        [37.45, -122.12],
        [37.31, -121.94],
        [37.08, -121.85],
        [37.08, -121.95],
        [37.29, -122.02],
        [37.53, -122.28],
        [37.72, -122.38],
      ]),
    ],
  },
  {
    slug: "la-metro",
    coverageModel: "polygon",
    officialUrl: "https://www.metro.net",
    note: "LA Metro coverage should be treated as a metro corridor network, not all of California.",
    source: "research",
    polygons: [
      rectangle("Los Angeles County Metro service area", 34.84, -118.95, 33.35, -117.63),
    ],
  },
  {
    slug: "mts-sd",
    coverageModel: "polygon",
    officialUrl: "https://www.sdmts.com",
    note: "San Diego MTS is a route network best represented as a service polygon.",
    source: "research",
    polygons: [
      rectangle("San Diego MTS service area", 33.52, -117.61, 32.53, -116.9),
    ],
  },
  {
    slug: "muni",
    coverageModel: "polygon",
    officialUrl: "https://www.sfmta.com/maps",
    note: "SF Muni is a dense municipal route network and should not be state-broad.",
    source: "research",
    polygons: [
      rectangle("San Francisco Muni service envelope", 37.833, -122.525, 37.705, -122.355),
    ],
  },
  {
    slug: "vta",
    coverageModel: "polygon",
    officialUrl: "https://www.vta.org/go/maps",
    note: "VTA should match Santa Clara corridor coverage rather than statewide California.",
    source: "research",
    polygons: [
      rectangle("Santa Clara Valley Transportation Authority", 37.49, -122.13, 36.92, -121.21),
    ],
  },
  {
    slug: "wmata",
    coverageModel: "polygon",
    officialUrl: "https://www.wmata.com",
    note: "WMATA spans DC, Maryland, and Virginia route corridors and needs route-aware matching.",
    source: "research",
    polygons: [
      rectangle("WMATA compact area", 39.18, -77.54, 38.69, -76.69),
    ],
  },
  {
    slug: "rtd",
    coverageModel: "polygon",
    officialUrl: "https://www.rtd-denver.com/routes-services",
    note: "RTD Denver should be represented as a regional route polygon.",
    source: "research",
    polygons: [
      rectangle("RTD Denver metro service area", 40.25, -105.55, 39.3, -104.55),
    ],
  },
  {
    slug: "dc-streetcar",
    coverageModel: "polygon",
    officialUrl: "https://dcstreetcar.com",
    note: "DC Streetcar is corridor-bound and should be modeled as a line/corridor match.",
    source: "research",
  },
  {
    slug: "capmetro",
    coverageModel: "polygon",
    officialUrl: "https://www.capmetro.org/ride/plan/schedmap",
    note: "CapMetro covers Austin corridors and is more precise than plain ZIP fallback.",
    source: "research",
    polygons: [
      rectangle("CapMetro Austin service area", 30.65, -98.01, 30.02, -97.38),
    ],
  },
  {
    slug: "dart",
    coverageModel: "polygon",
    officialUrl: "https://www.dart.org/guide/transit-and-use/dart-schedules-and-maps",
    note: "DART should be route-aware across the Dallas transit network.",
    source: "research",
    polygons: [
      rectangle("Dallas Area Rapid Transit service area", 33.19, -97.19, 32.55, -96.38),
    ],
  },
  {
    slug: "metro-houston",
    coverageModel: "polygon",
    officialUrl: "https://www.ridemetro.org/riding-metro/system-map",
    note: "Houston METRO is a corridor-based transit network.",
    source: "research",
    polygons: [
      rectangle("Houston METRO core service area", 30.2, -95.91, 29.33, -94.91),
    ],
  },
  {
    slug: "via-sa",
    coverageModel: "polygon",
    officialUrl: "https://www.viainfo.net",
    note: "VIA transit service is tied to San Antonio corridors rather than statewide TX.",
    source: "research",
    polygons: [
      rectangle("VIA Metropolitan Transit service area", 29.93, -98.98, 29.12, -98.19),
    ],
  },
  {
    slug: "uta",
    coverageModel: "polygon",
    officialUrl: "https://www.rideuta.com/Rider-Tools/Schedules-and-Maps",
    note: "UTA needs corridor-aware transit matching.",
    source: "research",
    polygons: [
      rectangle("UTA Wasatch Front corridor", 41.4, -112.12, 40.07, -111.5),
    ],
  },
  {
    slug: "sunpass",
    coverageModel: "polygon",
    officialUrl: "https://www.sunpass.com/en/about/aboutsunpass.shtml",
    note: "SunPass is a toll-network product and should follow road corridor coverage.",
    source: "research",
  },
  {
    slug: "fastrak",
    coverageModel: "polygon",
    officialUrl: "https://www.bayareafastrak.org/coverage-map",
    note: "FasTrak belongs to specific toll facilities and bridge corridors.",
    source: "research",
    polygons: [
      rectangle("Bay Area FasTrak toll region", 38.35, -123.12, 36.85, -121.58),
    ],
  },
  {
    slug: "good-to-go",
    coverageModel: "polygon",
    officialUrl: "https://wsdot.wa.gov/goodtogo",
    note: "Good To Go! maps to toll corridors, not statewide service by residence alone.",
    source: "research",
    polygons: [
      rectangle("Good To Go north Puget Sound corridor", 47.97, -122.52, 47.35, -121.86),
      rectangle("Good To Go south Puget Sound corridor", 47.4, -122.73, 46.92, -121.98),
    ],
  },
  {
    slug: "txtag",
    coverageModel: "polygon",
    officialUrl: "https://www.txtag.org",
    note: "TxTag is tied to toll corridors and agencies, so polygon matching is more honest than state fallback.",
    source: "research",
  },
  {
    slug: "ipass",
    coverageModel: "polygon",
    officialUrl: "https://www.getipass.com",
    note: "I-PASS belongs to the Illinois Tollway network and adjacent interoperable corridors.",
    source: "research",
    polygons: [
      rectangle("I-PASS northern Illinois toll corridor", 42.45, -88.65, 41.45, -87.45),
    ],
  },
  {
    slug: "alaska-communications",
    coverageModel: "live_address",
    officialUrl: "https://www.alaskacommunications.com/Residential",
    note: "Alaska Communications is best modeled as address-qualified availability.",
    source: "research",
  },
  {
    slug: "oncor-electric-delivery",
    coverageModel: "polygon",
    officialUrl: "https://www.oncor.com",
    note: "Oncor electric delivery territory should be polygon-modeled rather than broad Texas fallback.",
    source: "research",
  },
  {
    slug: "express-pass",
    coverageModel: "polygon",
    officialUrl: "https://www.expresspass.utah.gov",
    note: "Utah Express Pass belongs to toll corridors rather than a generic statewide residence match.",
    source: "research",
  },
  {
    slug: "ohio-turnpike-ezpass",
    coverageModel: "polygon",
    officialUrl: "https://www.ezpassoh.com",
    note: "Ohio Turnpike E-ZPass is corridor-based and should follow toll-network coverage.",
    source: "research",
  },
];

const coverageMetadataMap = new Map<string, ProviderCoverageMetadata>();

for (const entry of CURATED_RESEARCH_MODELS) {
  coverageMetadataMap.set(entry.slug, entry);
}

export function getProviderCoverageMetadataMap() {
  return coverageMetadataMap;
}

export function getProviderCoverageMetadata(slug?: string | null) {
  if (!slug) return null;
  return coverageMetadataMap.get(slug) || null;
}
