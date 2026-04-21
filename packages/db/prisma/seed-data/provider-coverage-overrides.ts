export interface ProviderCoverageOverride {
  slug: string;
  zipCodes: string[];
  sourceUrl: string;
  note: string;
}

export interface ProviderCoverageOverrideRecord {
  slug?: string;
  name: string;
  zipCodes?: string[];
}

export const PROVIDER_COVERAGE_OVERRIDES: ProviderCoverageOverride[] = [
  {
    slug: "con-edison",
    zipCodes: ["100", "101", "102", "103", "104", "105", "106", "107", "108", "111", "112", "113", "114", "116"],
    sourceUrl: "https://www.coned.com/en/business-partners/service-territories",
    note: "Con Edison serves all of New York City plus Westchester County.",
  },
  {
    slug: "peco",
    zipCodes: ["189", "190", "191", "193", "194"],
    sourceUrl: "https://www.peco.com/coverage-map",
    note: "PECO coverage is concentrated in Philadelphia and the surrounding southeastern Pennsylvania suburbs.",
  },
  {
    slug: "comed",
    zipCodes: ["600", "601", "602", "603", "604", "605", "606", "607", "608", "610", "611"],
    sourceUrl: "https://www.comed.com/coverage-map",
    note: "ComEd serves Chicago and much of northern Illinois.",
  },
  {
    slug: "bge",
    zipCodes: ["206", "207", "210", "211", "212", "214", "216", "217"],
    sourceUrl: "https://www.bge.com/coverage-map",
    note: "BGE coverage is centered on Baltimore and surrounding central Maryland counties.",
  },
  {
    slug: "pepco",
    zipCodes: ["200", "203", "204", "205", "207", "208", "209"],
    sourceUrl: "https://www.pepco.com/coverage-map",
    note: "Pepco covers the District of Columbia and nearby Maryland suburbs.",
  },
  {
    slug: "seattle-city-light",
    zipCodes: ["981"],
    sourceUrl: "https://www.seattle.gov/city-light",
    note: "Seattle City Light is a municipal utility serving the Seattle core service area.",
  },
  {
    slug: "aps-az",
    zipCodes: ["850", "851", "852", "853", "855"],
    sourceUrl: "https://www.aps.com/en/Business/Service-Plans/Service-Area-Maps",
    note: "APS service territory is concentrated in central and northern Arizona.",
  },
  {
    slug: "portland-general-electric",
    zipCodes: ["970", "971", "972", "973"],
    sourceUrl: "https://portlandgeneral.com/about/info/service-area",
    note: "Portland General Electric serves the Portland metro area and the northern Willamette Valley.",
  },
  {
    slug: "washington-gas",
    zipCodes: ["200", "203", "204", "205", "206", "207", "208", "209", "220", "221", "222", "223"],
    sourceUrl: "https://www.washingtongas.com/services/contractors/service-territory",
    note: "Washington Gas serves the District and nearby Maryland and Northern Virginia communities.",
  },
  {
    slug: "nicor",
    zipCodes: ["600", "601", "602", "603", "604", "605"],
    sourceUrl: "https://www.nicorgas.com/company/where-we-are/our-service-area/distribution-pipeline.html",
    note: "Nicor Gas serves the Chicago suburban collar counties.",
  },
  {
    slug: "centerpoint-energy",
    zipCodes: ["770", "772", "773", "774", "775"],
    sourceUrl: "https://www.centerpointenergy.com/en-us/home-service-plus/about-hsp/areas-we-serve",
    note: "CenterPoint Energy's Texas gas footprint is concentrated in the Houston metro area.",
  },
  {
    slug: "vt-gas",
    zipCodes: ["054"],
    sourceUrl: "https://vgsvt.com/service/coverage-map/",
    note: "Vermont Gas Systems primarily serves the Burlington and northwestern Vermont area.",
  },
  {
    slug: "austin-water",
    zipCodes: ["786", "787"],
    sourceUrl: "https://www.austintexas.gov/water",
    note: "Austin Water serves Austin and adjacent customers in the Austin area.",
  },
  {
    slug: "dallas-water",
    zipCodes: ["750", "751", "752", "753"],
    sourceUrl: "https://www.dallascityhall.com/departments/waterutilities",
    note: "Dallas Water Utilities serves Dallas and nearby service areas in the Dallas core.",
  },
  {
    slug: "houston-water",
    zipCodes: ["770", "772", "773", "774", "775"],
    sourceUrl: "https://www.houstontx.gov/publicworks",
    note: "Houston Public Works water service is concentrated in Houston and nearby metro ZIPs.",
  },
  {
    slug: "saws",
    zipCodes: ["780", "781", "782"],
    sourceUrl: "https://www.saws.org/about-saws/service-areas/",
    note: "San Antonio Water System serves San Antonio and the surrounding metro area.",
  },
  {
    slug: "nyc-water",
    zipCodes: ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"],
    sourceUrl: "https://www1.nyc.gov/site/dep",
    note: "NYC DEP water billing applies within New York City's borough ZIP ranges.",
  },
  {
    slug: "philly-water",
    zipCodes: ["191"],
    sourceUrl: "https://water.phila.gov",
    note: "Philadelphia Water Department is city-scoped to Philadelphia ZIP ranges.",
  },
  {
    slug: "chicago-water",
    zipCodes: ["606"],
    sourceUrl: "https://www.chicago.gov/water",
    note: "Chicago Water Department is city-scoped to Chicago ZIP ranges.",
  },
  {
    slug: "columbus-water",
    zipCodes: ["430", "431", "432"],
    sourceUrl: "https://www.columbus.gov/Services/Columbus-Water-Power/About-Columbus-Water-Power/Division-of-Power/Connecting-to-City-Power/Connect-to-City-Power-Service-Area-Map",
    note: "Columbus municipal utilities cover Columbus and immediate metro suburbs.",
  },
  {
    slug: "cincy-water",
    zipCodes: ["450", "451", "452"],
    sourceUrl: "https://www.cincinnati-oh.gov/water/about/outside-our-service-area/",
    note: "Cincinnati Water Works serves Cincinnati and nearby suburbs in southwest Ohio.",
  },
  {
    slug: "denver-water",
    zipCodes: ["800", "801", "802", "803", "804"],
    sourceUrl: "https://www.denverwater.org/about-us/how-we-operate/service-area",
    note: "Denver Water serves Denver and the broader nearby metro footprint.",
  },
  {
    slug: "phoenix-water",
    zipCodes: ["850"],
    sourceUrl: "https://www.phoenix.gov/waterservices",
    note: "Phoenix Water Services is concentrated in the City of Phoenix ZIP area.",
  },
  {
    slug: "mesa-utilities",
    zipCodes: ["852"],
    sourceUrl: "https://www.mesaaz.gov/utilities",
    note: "Mesa Utilities is concentrated in Mesa ZIP ranges.",
  },
  {
    slug: "lvvwd",
    zipCodes: ["890", "891"],
    sourceUrl: "https://www.lvvwd.com/customer-service/service-areas/index.html",
    note: "Las Vegas Valley Water District serves the Las Vegas Valley core ZIP ranges.",
  },
  {
    slug: "portland-water",
    zipCodes: ["970", "972"],
    sourceUrl: "https://www.portland.gov/service-areas/public-works",
    note: "Portland Water Bureau primarily serves Portland and nearby eastside service ZIPs.",
  },
  {
    slug: "seattle-public-utilities",
    zipCodes: ["981"],
    sourceUrl: "https://www.seattle.gov/utilities/construction-resources/water/water-drainage-and-wastewater-availability-certificate",
    note: "Seattle Public Utilities water availability is city-scoped to Seattle ZIP ranges.",
  },
  {
    slug: "dc-water",
    zipCodes: ["200", "203", "204", "205"],
    sourceUrl: "https://www.dcwater.com",
    note: "DC Water is scoped to District of Columbia ZIP ranges.",
  },
  {
    slug: "raleigh-water",
    zipCodes: ["275", "276"],
    sourceUrl: "https://raleighnc.gov/apps-maps-and-open-data",
    note: "Raleigh Water is concentrated in Raleigh and nearby Wake County ZIP ranges.",
  },
  {
    slug: "charlotte-water",
    zipCodes: ["280", "281", "282"],
    sourceUrl: "https://charlottenc.gov/Water",
    note: "Charlotte Water serves Charlotte and adjacent Mecklenburg County suburbs.",
  },
  {
    slug: "fairfax-water",
    zipCodes: ["220", "221", "223"],
    sourceUrl: "https://www.fairfaxwater.org",
    note: "Fairfax Water is concentrated in Fairfax County and nearby Northern Virginia service ZIPs.",
  },
  {
    slug: "milwaukee-water",
    zipCodes: ["532"],
    sourceUrl: "https://city.milwaukee.gov/water",
    note: "Milwaukee Water Works is city-scoped to Milwaukee ZIP ranges.",
  },
  {
    slug: "nashville-water",
    zipCodes: ["370", "371", "372"],
    sourceUrl: "https://www.nashville.gov/departments/water",
    note: "Nashville Water Services covers Nashville and the nearby Davidson County metro area.",
  },
  {
    slug: "tucson-water",
    zipCodes: ["856", "857"],
    sourceUrl: "https://www.tucsonaz.gov/water",
    note: "Tucson Water is concentrated in Tucson and southern Pima County ZIP ranges.",
  },
  {
    slug: "ac-transit",
    zipCodes: ["945", "946", "947", "948"],
    sourceUrl: "https://www.actransit.org/overview-maps",
    note: "AC Transit serves Alameda and Contra Costa County core service ZIP ranges.",
  },
  {
    slug: "capmetro",
    zipCodes: ["786", "787"],
    sourceUrl: "https://www.capmetro.org/ride/plan/schedmap",
    note: "CapMetro is concentrated in the Austin metro service area.",
  },
  {
    slug: "cota",
    zipCodes: ["430", "431", "432"],
    sourceUrl: "https://www.cota.com/services/cota-bus/",
    note: "COTA serves Columbus and nearby Franklin County metro ZIP ranges.",
  },
  {
    slug: "cta",
    zipCodes: ["606", "607", "608"],
    sourceUrl: "https://www.transitchicago.com/frequent/",
    note: "CTA frequent network and city service area are concentrated in Chicago and inner-ring ZIP ranges.",
  },
  {
    slug: "pace",
    zipCodes: ["600", "601", "602", "603", "604", "605", "607", "608"],
    sourceUrl: "https://www.pacebus.com/accessible-fixed-routes",
    note: "Pace Bus serves the Chicago suburban collar county ZIP ranges.",
  },
  {
    slug: "septa",
    zipCodes: ["189", "190", "191", "193", "194"],
    sourceUrl: "https://www.septa.org/coverage-map",
    note: "SEPTA covers Philadelphia and the surrounding southeastern Pennsylvania counties.",
  },
  {
    slug: "trinity-metro",
    zipCodes: ["760", "761", "762"],
    sourceUrl: "https://ridetrinitymetro.org/abc-maps/",
    note: "Trinity Metro serves Fort Worth and the nearby Tarrant County ZIP ranges.",
  },
  {
    slug: "mcts",
    zipCodes: ["530", "531", "532"],
    sourceUrl: "https://www.ridemcts.com/accessibility/transit-plus/transit-plus-fares-and-service-area",
    note: "MCTS service is centered on Milwaukee County ZIP ranges.",
  },
  {
    slug: "ipass",
    zipCodes: ["600", "601", "602", "603", "604", "605", "606", "607", "608"],
    sourceUrl: "https://getipass.com/coverage-map",
    note: "I-PASS use is concentrated on the Illinois Tollway network across Chicago-area ZIP corridors.",
  },

  // ── California ──
  {
    slug: "pge",
    zipCodes: ["940", "941", "942", "943", "944", "945", "946", "947", "948", "949", "950", "951", "952", "953", "954", "955", "956", "957", "958", "959", "960", "961"],
    sourceUrl: "https://www.pge.com/en/account/your-home/understanding-your-rate/electric-maps.html",
    note: "PG&E serves Northern and Central California from the Bay Area through the Central Valley and north state.",
  },
  {
    slug: "sce",
    zipCodes: ["910", "911", "912", "913", "914", "915", "916", "917", "918", "919", "920", "921", "922", "923", "924", "925", "926", "927", "928"],
    sourceUrl: "https://www.sce.com/residential/service-area",
    note: "Southern California Edison serves most of Southern California excluding the City of LA (LADWP) and San Diego (SDG&E).",
  },
  {
    slug: "ladwp",
    zipCodes: ["900", "901", "902", "903", "904", "905", "906", "907", "908", "909"],
    sourceUrl: "https://www.ladwp.com",
    note: "Los Angeles Department of Water and Power serves only City of Los Angeles ZIP ranges.",
  },
  {
    slug: "socalgas",
    zipCodes: ["900", "901", "902", "903", "904", "905", "906", "907", "908", "909", "910", "911", "912", "913", "914", "915", "916", "917", "918", "919", "920", "921", "922", "923", "924", "925", "926", "927", "928", "930", "931", "932", "933", "934", "935"],
    sourceUrl: "https://www.socalgas.com/about-us/company-information/service-territory",
    note: "SoCal Gas serves Southern and Central California for natural gas across the SCE and LADWP electric territories.",
  },

  // ── Pacific Northwest ──
  {
    slug: "cascade-wa-gas",
    zipCodes: ["980", "981", "982", "983", "984", "985", "986", "987", "988", "989"],
    sourceUrl: "https://www.cascadenaturalgas.com",
    note: "Cascade Natural Gas serves western and central Washington state.",
  },
  {
    slug: "trimet",
    zipCodes: ["970", "971", "972", "973", "974"],
    sourceUrl: "https://trimet.org/about/coverage.htm",
    note: "TriMet serves the Portland metro area including Multnomah, Washington, and Clackamas counties.",
  },

  // ── Nevada / Southwest ──
  {
    slug: "nv-energy",
    zipCodes: ["889", "890", "891", "893", "894", "895", "897", "898"],
    sourceUrl: "https://www.nvenergy.com/about-nvenergy/our-company/our-service-area",
    note: "NV Energy serves Nevada including Las Vegas (south) and Reno (north) service territories.",
  },
  {
    slug: "southwest-gas",
    zipCodes: ["850", "851", "852", "853", "855", "856", "857", "859", "860", "889", "890", "891"],
    sourceUrl: "https://www.swgas.com/en/service-territory",
    note: "Southwest Gas serves Arizona (Phoenix, Tucson) and Nevada (Las Vegas) for natural gas.",
  },

  // ── Texas ──
  {
    slug: "txu-energy",
    zipCodes: ["750", "751", "752", "753", "754", "755", "756", "757", "758", "759", "760", "761", "762", "763"],
    sourceUrl: "https://www.txu.com",
    note: "TXU Energy operates in the deregulated ERCOT market, primarily serving North Texas and the DFW metro area.",
  },
  {
    slug: "atmos-energy",
    zipCodes: ["750", "751", "752", "753", "754", "755", "756", "757", "758", "759", "760", "761", "762", "763", "764", "765", "766", "767", "768", "769", "770", "771", "772", "773", "774", "775", "776", "777", "778", "779", "780", "781", "782", "783", "784", "785", "786", "787", "788", "789", "790", "791", "792", "793", "794", "795", "796", "797", "798", "799"],
    sourceUrl: "https://www.atmosenergy.com/natural-gas/service-area",
    note: "Atmos Energy is the primary natural gas distribution company across most of Texas.",
  },

  // ── New England ──
  {
    slug: "eversource",
    zipCodes: ["010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027", "060", "061", "062", "063", "064", "065", "066", "067", "068", "069"],
    sourceUrl: "https://www.eversource.com/content/ct-c/about/about-us/company-overview/our-service-territory",
    note: "Eversource serves Connecticut and Massachusetts for electric and gas service.",
  },
  {
    slug: "eversource-nh",
    zipCodes: ["030", "031", "032", "033", "034", "035", "036", "037", "038"],
    sourceUrl: "https://www.eversource.com/content/nh-c/about/about-us/company-overview/our-service-territory",
    note: "Eversource New Hampshire serves the major service territories in New Hampshire.",
  },
  {
    slug: "national-grid-ma",
    zipCodes: ["010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027"],
    sourceUrl: "https://www.nationalgridus.com/MA-Home/",
    note: "National Grid MA provides natural gas service across Massachusetts.",
  },
  {
    slug: "ri-energy",
    zipCodes: ["028", "029"],
    sourceUrl: "https://www.rienergy.com/RI-Home/aboutus/servicearea",
    note: "Rhode Island Energy serves Rhode Island for electric service.",
  },
  {
    slug: "ri-energy-gas",
    zipCodes: ["028", "029"],
    sourceUrl: "https://www.rienergy.com/RI-Home/aboutus/servicearea",
    note: "Rhode Island Energy provides natural gas service throughout Rhode Island.",
  },
  {
    slug: "socogas-ct",
    zipCodes: ["060", "061", "062", "063", "064", "065", "066", "067", "068", "069"],
    sourceUrl: "https://www.socogas.com",
    note: "Southern Connecticut Gas provides natural gas in southwestern Connecticut.",
  },
  {
    slug: "mbta",
    zipCodes: ["017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027"],
    sourceUrl: "https://www.mbta.com/maps",
    note: "MBTA serves the greater Boston metro area and surrounding commuter rail zones.",
  },

  // ── New Jersey ──
  {
    slug: "pseg",
    zipCodes: ["070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089"],
    sourceUrl: "https://www.pseg.com",
    note: "PSE&G provides electric and gas service throughout most of New Jersey.",
  },
  {
    slug: "jcpl",
    zipCodes: ["070", "074", "075", "076", "077", "078", "079", "083", "084", "085", "086", "087", "088", "089"],
    sourceUrl: "https://www.firstenergycorp.com/jcpl/",
    note: "JCP&L (Jersey Central Power & Light) serves eastern and western portions of New Jersey.",
  },
  {
    slug: "elizabethtown-gas",
    zipCodes: ["070", "071", "072", "073", "074", "075", "076", "077", "078", "083", "084", "085", "086", "087", "088"],
    sourceUrl: "https://www.elizabethtowngas.com/about/company-info",
    note: "Elizabethtown Gas serves natural gas customers throughout New Jersey.",
  },
  {
    slug: "nj-american-water",
    zipCodes: ["070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089"],
    sourceUrl: "https://www.amwater.com/njaw",
    note: "New Jersey American Water serves water customers throughout New Jersey.",
  },
  {
    slug: "nj-transit",
    zipCodes: ["070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089"],
    sourceUrl: "https://www.njtransit.com/maps",
    note: "NJ Transit provides bus, rail, and light rail service throughout New Jersey.",
  },

  // ── Mid-Atlantic ──
  {
    slug: "dominion",
    zipCodes: ["220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246"],
    sourceUrl: "https://www.dominionenergy.com/virginia",
    note: "Dominion Energy Virginia serves the Commonwealth of Virginia as the primary electric utility.",
  },
  {
    slug: "delmarva-power-de",
    zipCodes: ["197", "198", "199"],
    sourceUrl: "https://www.delmarva.com/contact-us/service-territory/",
    note: "Delmarva Power serves Delaware and the Eastern Shore of Maryland for electric service.",
  },
  {
    slug: "ppl",
    zipCodes: ["170", "171", "172", "173", "174", "175", "176", "177", "178", "179", "180", "181", "182", "183", "184", "185", "186", "187", "188"],
    sourceUrl: "https://www.pplelectric.com/about-ppl/our-territory",
    note: "PPL Electric Utilities serves central and eastern Pennsylvania for electric service.",
  },
  {
    slug: "pittsburgh-water",
    zipCodes: ["150", "151", "152"],
    sourceUrl: "https://www.pgh2o.com",
    note: "Pittsburgh Water and Sewer Authority serves the City of Pittsburgh.",
  },

  // ── Southeast ──
  {
    slug: "duke-nc",
    zipCodes: ["270", "271", "272", "273", "274", "275", "276", "277", "278", "279", "280", "281", "282", "283", "284", "285", "286", "287", "288", "289"],
    sourceUrl: "https://www.duke-energy.com/home/company/service-territory",
    note: "Duke Energy serves North Carolina as the primary electric utility.",
  },
  {
    slug: "duke-fl",
    zipCodes: ["326", "327", "328", "329", "330", "331", "332", "333", "334", "335", "336", "337", "338", "339", "340", "341", "342", "343", "344", "345", "346", "347", "348", "349"],
    sourceUrl: "https://www.duke-energy.com/home/company/service-territory",
    note: "Duke Energy Florida serves the central Florida region.",
  },
  {
    slug: "duke-in",
    zipCodes: ["460", "461", "462", "463", "464", "465", "466", "467", "468", "469", "470", "471", "472", "473", "474", "475", "476", "477", "478", "479"],
    sourceUrl: "https://www.duke-energy.com/home/company/service-territory",
    note: "Duke Energy Indiana serves northern and central Indiana.",
  },
  {
    slug: "georgia-power",
    zipCodes: ["300", "301", "302", "303", "304", "305", "306", "307", "308", "309", "310", "311", "312", "313", "314", "315", "316", "317", "318", "319"],
    sourceUrl: "https://www.georgiapower.com",
    note: "Georgia Power is the primary electric utility serving the state of Georgia.",
  },
  {
    slug: "alabama-power",
    zipCodes: ["350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "360", "361", "362", "363", "364", "365", "366", "367", "368", "369"],
    sourceUrl: "https://www.alabamapower.com/company/our-service-area.html",
    note: "Alabama Power is the primary electric utility serving most of Alabama.",
  },
  {
    slug: "alagasco",
    zipCodes: ["350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "360", "361", "362", "363", "364", "365", "366", "367", "368", "369"],
    sourceUrl: "https://www.alagasco.com",
    note: "Alabama Gas (Alagasco/Spire Alabama) provides natural gas service throughout Alabama.",
  },
  {
    slug: "marta",
    zipCodes: ["300", "301", "302", "303", "304", "305", "306", "307"],
    sourceUrl: "https://www.itsmarta.com/maps/system-map.aspx",
    note: "MARTA serves Fulton, DeKalb, and Clayton counties in the Atlanta metro area.",
  },
  {
    slug: "atlanta-water",
    zipCodes: ["300", "301", "302", "303", "304"],
    sourceUrl: "https://www.atlantaga.gov/government/departments/watershed-management",
    note: "Atlanta Department of Watershed Management serves Atlanta City limits.",
  },
  {
    slug: "entergy-la",
    zipCodes: ["700", "701", "702", "703", "704", "705", "706", "707", "708", "710", "711", "712", "713", "714"],
    sourceUrl: "https://www.entergy-louisiana.com/your_home/service_area.aspx",
    note: "Entergy Louisiana provides electric service throughout Louisiana.",
  },
  {
    slug: "entergy-ms",
    zipCodes: ["386", "387", "388", "389", "390", "391", "392", "393", "394", "395", "396", "397"],
    sourceUrl: "https://www.entergy-mississippi.com/your_home/service_area.aspx",
    note: "Entergy Mississippi provides electric service throughout Mississippi.",
  },
  {
    slug: "mississippi-power",
    zipCodes: ["393", "394", "395", "396", "397"],
    sourceUrl: "https://www.mississippipower.com",
    note: "Mississippi Power serves the southeastern portion of Mississippi.",
  },
  {
    slug: "miami-transit",
    zipCodes: ["330", "331", "332", "333", "334", "335"],
    sourceUrl: "https://www.miamidade.gov/transit/map.asp",
    note: "Miami-Dade Transit serves Miami-Dade County with bus, Metrorail, and Metromover.",
  },
  {
    slug: "miami-water",
    zipCodes: ["330", "331", "332", "333", "334", "335", "336", "337"],
    sourceUrl: "https://www.miamidade.gov/water/",
    note: "Miami-Dade Water and Sewer serves Miami-Dade County.",
  },
  {
    slug: "durham-water",
    zipCodes: ["277", "278"],
    sourceUrl: "https://www.durhamnc.gov/205/Water-Management",
    note: "Durham Water Management serves the City of Durham and surrounding service areas.",
  },
  {
    slug: "charleston-water-sc",
    zipCodes: ["294", "295"],
    sourceUrl: "https://www.charlestonwater.com",
    note: "Charleston Water System serves the Charleston, SC metro area.",
  },

  // ── Midwest — Michigan ──
  {
    slug: "consumers-energy",
    zipCodes: ["480", "481", "482", "483", "484", "485", "486", "487", "488", "489", "490", "491", "492", "493", "494", "495", "496", "497", "498", "499"],
    sourceUrl: "https://www.consumersenergy.com/residential/products-and-services/service-territory",
    note: "Consumers Energy serves gas and electric customers throughout the lower peninsula of Michigan.",
  },
  {
    slug: "dte",
    zipCodes: ["480", "481", "482", "483", "484", "485"],
    sourceUrl: "https://www.dteenergy.com",
    note: "DTE Energy is the primary electric and gas utility for southeastern Michigan including metropolitan Detroit.",
  },

  // ── Midwest — Wisconsin ──
  {
    slug: "we-energies",
    zipCodes: ["530", "531", "532", "533", "534"],
    sourceUrl: "https://www.we-energies.com/about-us/service-territory/",
    note: "We Energies serves southeastern Wisconsin including Milwaukee for electric and gas.",
  },
  {
    slug: "wps-wi-gas",
    zipCodes: ["541", "542", "543", "544", "545", "546", "547", "548", "549"],
    sourceUrl: "https://www.wisconsinpublicservice.com/company/about-us/service-territory",
    note: "Wisconsin Public Service provides natural gas to customers in northeast and central Wisconsin.",
  },

  // ── Midwest — Ohio ──
  {
    slug: "aep-ohio",
    zipCodes: ["430", "431", "432", "433", "434", "435", "436", "437", "438", "439", "440", "441", "442", "443", "444", "445", "446", "447", "448", "449", "450", "451", "452", "453", "454", "455", "456"],
    sourceUrl: "https://www.aepohio.com/about/",
    note: "AEP Ohio serves electric customers throughout Ohio.",
  },
  {
    slug: "columbia-gas-oh",
    zipCodes: ["430", "431", "432", "433", "434", "435", "436", "437", "438", "439", "440", "441", "442", "443", "444", "445", "446", "447", "448", "449", "450", "451", "452", "453", "454", "455", "456", "457", "458"],
    sourceUrl: "https://www.columbiagasohio.com/about/service-territory",
    note: "Columbia Gas of Ohio provides natural gas service throughout Ohio.",
  },
  {
    slug: "cleveland-water",
    zipCodes: ["440", "441", "442", "443", "444"],
    sourceUrl: "https://clevelandwater.com/service-area",
    note: "Cleveland Water serves Cleveland and surrounding communities in northeast Ohio.",
  },

  // ── Midwest — Missouri / Illinois ──
  {
    slug: "ameren-mo",
    zipCodes: ["630", "631", "632", "633", "634", "635", "636", "637", "638", "639", "640", "641", "642", "643", "644", "645", "646", "647", "648", "649"],
    sourceUrl: "https://www.ameren.com/missouri/company/about-ameren-missouri",
    note: "Ameren Missouri is the primary electric and gas utility serving Missouri.",
  },
  {
    slug: "peoples-gas",
    zipCodes: ["606", "607", "608"],
    sourceUrl: "https://www.peoplesgasdelivery.com",
    note: "Peoples Gas is the primary natural gas distribution utility for Chicago.",
  },
  {
    slug: "metro-stl",
    zipCodes: ["630", "631", "632"],
    sourceUrl: "https://www.metrostlouis.org/maps-schedules/",
    note: "Metro (St. Louis) serves the St. Louis metropolitan area for light rail and bus.",
  },

  // ── Midwest — Minnesota ──
  {
    slug: "metro-mn",
    zipCodes: ["550", "551", "552", "553", "554", "555", "560", "561", "562"],
    sourceUrl: "https://www.metrotransit.org/maps-schedules",
    note: "Metro Transit Minnesota serves the Minneapolis-Saint Paul metro area.",
  },
  {
    slug: "minneapolis-water",
    zipCodes: ["554", "555"],
    sourceUrl: "https://www.minneapolismn.gov/government/departments/public-works/drinking-water/",
    note: "Minneapolis Water is the municipal water utility for the City of Minneapolis.",
  },

  // ── Kentucky / Louisville ──
  {
    slug: "louisville-water",
    zipCodes: ["400", "401", "402"],
    sourceUrl: "https://www.louisvillewater.com/service-area",
    note: "Louisville Water Company serves Louisville and surrounding Jefferson County.",
  },

  // ── New Mexico ──
  {
    slug: "nmgas",
    zipCodes: ["870", "871", "872", "873", "874", "875", "876", "877", "878", "879", "880", "881", "882", "883", "884"],
    sourceUrl: "https://www.nmgas.com/about-us/service-area",
    note: "New Mexico Gas Company provides natural gas service throughout New Mexico.",
  },
];

const overrideMap = new Map(PROVIDER_COVERAGE_OVERRIDES.map((override) => [override.slug, override]));

export function applyProviderCoverageOverrides<T extends ProviderCoverageOverrideRecord>(records: T[]): T[] {
  return records.map((record) => {
    const slug = record.slug?.trim();
    if (!slug) return record;

    const override = overrideMap.get(slug);
    if (!override) return record;

    const zipCodes = Array.from(new Set([...(record.zipCodes || []), ...override.zipCodes]));
    return {
      ...record,
      zipCodes,
    };
  });
}
