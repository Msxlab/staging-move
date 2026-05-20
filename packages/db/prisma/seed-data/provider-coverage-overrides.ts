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

const MD_WSSC_ZIPS = [
  "20601", "20607", "20608", "20613", "20623", "20703", "20704", "20705", "20706", "20707", "20708", "20710", "20712", "20715", "20716", "20717", "20718", "20720", "20721", "20722", "20725", "20726", "20731", "20735", "20737", "20738", "20740", "20741", "20742", "20743", "20744", "20745", "20746", "20747", "20748", "20749", "20752", "20753", "20757", "20762", "20768", "20769", "20770", "20771", "20772", "20773", "20774", "20775", "20781", "20782", "20783", "20784", "20785", "20787", "20788", "20790", "20791", "20792", "20797", "20799",
  "20812", "20814", "20815", "20816", "20817", "20818", "20832", "20833", "20837", "20838", "20839", "20841", "20842", "20850", "20851", "20852", "20853", "20854", "20855", "20857", "20859", "20860", "20861", "20862", "20866", "20868", "20871", "20872", "20874", "20876", "20877", "20878", "20879", "20880", "20882", "20886", "20889", "20892", "20895", "20896", "20898", "20899", "20901", "20902", "20903", "20904", "20905", "20906", "20910", "20912", "20914", "20915", "20916", "20918", "20993",
];

const CO_XCEL_ZIPS = [
  "80002", "80003", "80004", "80005", "80007", "80010", "80011", "80012", "80013", "80014", "80015", "80016", "80017", "80018", "80019", "80020", "80021", "80022", "80023", "80026", "80027", "80030", "80031", "80033", "80045",
  "80110", "80111", "80112", "80113", "80120", "80121", "80122", "80123", "80124", "80126", "80127", "80128", "80129", "80130", "80134", "80138",
  "80202", "80203", "80204", "80205", "80206", "80207", "80209", "80210", "80211", "80212", "80216", "80218", "80219", "80220", "80221", "80222", "80223", "80224", "80227", "80230", "80231", "80236", "80237", "80238", "80239", "80246", "80247", "80249", "80260", "80264", "80265", "80290", "80293", "80294",
  "80301", "80302", "80303", "80304", "80305", "80309", "80310", "80314",
];

const CO_EXPRESSTOLL_ZIPS = [
  "80010", "80011", "80012", "80013", "80014", "80015", "80016", "80017", "80018", "80019", "80020", "80021", "80022", "80023", "80027", "80045",
  "80111", "80112", "80124", "80134", "80138",
  "80202", "80203", "80204", "80205", "80206", "80207", "80209", "80210", "80211", "80212", "80216", "80218", "80219", "80220", "80221", "80222", "80223", "80224", "80230", "80231", "80237", "80238", "80239", "80246", "80247", "80249",
  "80301", "80302", "80303", "80304", "80305", "80401", "80501", "80504", "80601", "80602", "80603",
];

const CO_DENVER_WATER_ZIPS = [
  "80002", "80003", "80004", "80010", "80011", "80012", "80014", "80033",
  "80202", "80203", "80204", "80205", "80206", "80207", "80209", "80210", "80211", "80212", "80214", "80215", "80216", "80218", "80219", "80220", "80221", "80222", "80223", "80224", "80226", "80227", "80228", "80230", "80231", "80232", "80235", "80236", "80237", "80238", "80239", "80246", "80247", "80249",
];

const CO_BLACK_HILLS_ZIPS = [
  "81001", "81003", "81004", "81005", "81006", "81007", "81008", "81050", "81052", "81067", "81082", "81212", "81226", "81240",
];

const UT_SLC_PUBLIC_UTILITIES_ZIPS = [
  "84101", "84102", "84103", "84104", "84105", "84106", "84108", "84109", "84111", "84112", "84113", "84115", "84116", "84150", "84180",
];

const FL_DUKE_ENERGY_ZIPS = ["321", "326", "327", "328", "335", "337", "338", "344", "346", "347"];

const FL_TAMPA_CITY_ZIPS = ["33602", "33603", "33604", "33605", "33606", "33607", "33609", "33610", "33611", "33612", "33614", "33615", "33616", "33617", "33618", "33619", "33620", "33621", "33629", "33634", "33635", "33637"];

const AR_STATE_ZIPS = ["716", "717", "718", "719", "720", "721", "722", "723", "724", "725", "726", "727", "728", "729"];

const AR_SWEPCO_ZIPS = ["718", "727", "728", "729"];

const AR_OGE_ZIPS = ["729"];

const AR_SUMMIT_GAS_ZIPS = AR_STATE_ZIPS;

const AR_BLACK_HILLS_GAS_ZIPS = ["720", "721", "724", "725", "726", "727", "728", "729"];

const AR_AOG_ZIPS = ["728", "729"];

const AR_CARROLL_ELECTRIC_ZIPS = ["726", "727", "728"];

const AR_FIRST_ELECTRIC_ZIPS = ["720", "721", "722", "723"];

const AR_CENTRAL_WATER_ZIPS = ["720", "721", "722"];

const AR_NORTH_LITTLE_ROCK_ZIPS = ["721", "722"];

const AR_CONWAY_ZIPS = ["720"];

const AR_NWA_ZIPS = ["727"];

const AR_FORT_SMITH_ZIPS = ["729"];

const OR_PORTLAND_METRO_ZIPS = ["970", "971", "972"];
const OR_PGE_ZIPS = ["970", "971", "972", "973"];
const OR_PACIFIC_POWER_ZIPS = ["970", "973", "974", "975", "976", "977", "978"];
const OR_IDAHO_POWER_ZIPS = ["979"];
const OR_BREEZEBY_ZIPS = ["970", "986"];
const PNW_NW_NATURAL_ZIPS = ["970", "971", "972", "973", "974", "986"];
const PNW_CASCADE_GAS_ZIPS = ["970", "971", "973", "977", "978", "982", "983", "985", "986", "988", "989", "993"];
const OR_AVISTA_GAS_ZIPS = ["976", "978"];
const OR_EUGENE_ZIPS = ["974"];
const OR_COASTAL_ZIPS = ["971", "973", "974"];
const OR_EASTERN_ZIPS = ["978", "979"];
const OR_CENTRAL_ZIPS = ["977"];
const OR_MEDFORD_ZIPS = ["975"];
const OR_SALEM_ZIPS = ["973"];
const OR_TVWD_HILLSBORO_ZIPS = ["970", "971"];
const OR_GRESHAM_ZIPS = ["970", "972"];

const AZ_STATE_ZIPS = ["850", "851", "852", "853", "855", "856", "857", "859", "860", "863", "864", "865"];

const AZ_PHOENIX_METRO_ZIPS = ["850", "851", "852", "853"];

const AZ_PHOENIX_CITY_ZIPS = ["850"];

const AZ_TUCSON_ZIPS = ["856", "857"];

const AZ_APS_ZIPS = ["850", "851", "852", "853", "855", "859", "860", "863"];

const AZ_SRP_ZIPS = AZ_PHOENIX_METRO_ZIPS;

const AZ_SOUTHWEST_GAS_ZIPS = ["850", "851", "852", "853", "855", "856", "857", "859", "860"];

const AZ_SOUTHWEST_GAS_NV_ZIPS = ["889", "890", "891"];

const AZ_NV_SOUTHWEST_GAS_ZIPS = [...AZ_SOUTHWEST_GAS_ZIPS, ...AZ_SOUTHWEST_GAS_NV_ZIPS];

const AZ_UNISOURCE_ZIPS = ["856", "864"];

const AZ_PRIVATE_WATER_ZIPS = AZ_STATE_ZIPS;

const AZ_TRICO_ZIPS = AZ_TUCSON_ZIPS;

const AZ_MOHAVE_ELECTRIC_ZIPS = ["864"];

const AZ_SSVEC_ZIPS = ["856", "859"];

const NV_STATE_ZIPS = ["889", "890", "891", "893", "894", "895", "896", "897", "898"];

const NV_SOUTHERN_ZIPS = ["889", "890", "891"];

const NV_LAS_VEGAS_VALLEY_ZIPS = NV_SOUTHERN_ZIPS;

const NV_RENO_SPARKS_ZIPS = ["894", "895"];

const NV_CARSON_CITY_ZIPS = ["897"];

const NV_ENERGY_ZIPS = NV_STATE_ZIPS;

const NV_WM_ZIPS = ["894", "895", "897", "898"];

const NV_PRIVATE_WATER_ZIPS = NV_STATE_ZIPS;

const GA_PEACH_PASS_ZIPS = [
  "30004", "30005", "30009", "30022", "30024", "30030", "30040", "30041", "30043", "30044", "30046", "30060", "30062", "30064", "30066", "30067", "30068", "30071", "30075", "30076", "30080", "30092", "30093", "30096", "30097",
  "30101", "30102", "30106", "30114", "30115", "30126", "30127", "30132", "30134", "30144", "30152", "30157", "30168",
  "30213", "30214", "30215", "30228", "30236", "30238", "30253", "30269", "30274", "30281", "30290", "30291", "30296",
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30328", "30329", "30331", "30336", "30337", "30338", "30339", "30340", "30341", "30342", "30344", "30345", "30346", "30349", "30350", "30354",
];

const GA_ATLANTA_CORE_ZIPS = [
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30331", "30336", "30337", "30339", "30342", "30344", "30345", "30354", "30363",
];

const GA_NATURAL_GAS_MARKET_ZIPS = ["300", "301", "302", "303", "305", "306", "310", "312", "314"];

const NC_DUKE_PREFILTER_ZIPS = ["270", "271", "272", "273", "274", "275", "276", "277", "278", "279", "280", "281", "282", "283", "284", "285", "286", "287", "288", "289"];

const NC_QUICK_PASS_ZIPS = [
  "27502", "27511", "27513", "27518", "27519", "27523", "27526", "27529", "27539", "27540", "27560", "27562", "27601", "27603", "27606", "27607", "27613", "27617",
  "28012", "28031", "28036", "28078", "28104", "28105", "28110", "28112", "28173",
  "28202", "28203", "28204", "28205", "28206", "28207", "28208", "28209", "28210", "28211", "28214", "28216", "28217", "28226", "28262", "28269", "28270", "28273", "28277", "28278",
];

const NC_CHARLOTTE_ZIPS = [
  "28202", "28203", "28204", "28205", "28206", "28207", "28208", "28209", "28210", "28211", "28212", "28213", "28214", "28215", "28216", "28217", "28226", "28227", "28262", "28269", "28270", "28273", "28277", "28278", "28280", "28281", "28282",
];

const NC_RALEIGH_SERVICE_ZIPS = [
  "27511", "27513", "27518", "27519", "27520", "27522", "27526", "27529", "27539", "27540", "27545", "27571", "27587", "27591", "27597",
  "27601", "27603", "27604", "27605", "27606", "27607", "27608", "27609", "27610", "27612", "27613", "27614", "27615", "27616", "27617",
];

const NC_DURHAM_ZIPS = ["27701", "27703", "27704", "27705", "27707", "27709", "27712", "27713"];

const NC_GREENSBORO_ZIPS = ["27401", "27403", "27405", "27406", "27407", "27408", "27409", "27410", "27455"];

const NC_WINSTON_SALEM_ZIPS = ["27012", "27023", "27040", "27045", "27101", "27103", "27104", "27105", "27106", "27107", "27109", "27110", "27127"];

const NC_OWASA_ZIPS = ["27510", "27514", "27516", "27517", "27599"];

const NC_DOMINION_ELECTRIC_ZIPS = [
  "27809", "27818", "27822", "27823", "27828", "27829", "27834", "27837", "27858", "27886",
  "27909", "27910", "27917", "27921", "27923", "27932", "27937", "27939", "27941", "27942", "27944", "27946", "27948", "27949", "27954", "27956", "27957", "27958", "27959", "27962", "27964", "27966", "27970", "27974", "27976", "27980", "27981", "27983", "27986",
];

const NC_ENBRIDGE_GAS_ZIPS = ["272", "273", "274", "275", "276", "277", "278", "279", "280", "281", "282", "283", "284", "285", "286", "287", "288"];

const NC_PIEDMONT_GAS_ZIPS = ["270", "271", "272", "273", "274", "275", "276", "277", "280", "281", "282", "286", "287", "288"];

const NC_FRONTIER_GAS_ZIPS = ["270", "271", "286", "287"];

const NC_ENERGYUNITED_ZIPS = [
  "27006", "27013", "27028", "27054", "27127", "27284", "27360",
  "28023", "28025", "28027", "28031", "28036", "28078",
  "28115", "28117", "28120", "28124", "28125", "28144", "28147", "28159", "28166",
  "28625", "28634", "28677", "28682",
];

const NC_BLUE_RIDGE_ENERGY_ZIPS = ["28604", "28605", "28607", "28615", "28618", "28624", "28626", "28640", "28645", "28646", "28659", "28665", "28670", "28681", "28684", "28694", "28697", "28698", "28717", "28741"];

const NC_BRUNSWICK_ELECTRIC_ZIPS = ["28420", "28422", "28451", "28461", "28462", "28465", "28467", "28469", "28470", "28479", "28480", "29566", "29582"];

const NC_PRIVATE_WATER_ZIPS = ["270", "271", "272", "273", "274", "275", "276", "277", "278", "280", "281", "282", "283", "284", "285", "286", "287"];

const SC_STATE_ZIPS = ["290", "291", "292", "293", "294", "295", "296", "297", "298", "299"];

const SC_UPSTATE_ZIPS = ["293", "296"];

const SC_MIDLANDS_ZIPS = ["290", "291", "292"];

const SC_GRAND_STRAND_ZIPS = ["295"];

const SC_YORK_LANCASTER_ZIPS = ["297"];

const SC_CHARLESTON_ZIPS = ["294"];

const SC_GREENVILLE_WATER_ZIPS = ["296"];

const SC_COLUMBIA_WATER_ZIPS = SC_MIDLANDS_ZIPS;

const SC_SPARTANBURG_WATER_ZIPS = ["293"];

const SC_BEAUFORT_JASPER_WATER_ZIPS = ["299"];

const SC_GRAND_STRAND_WATER_ZIPS = SC_GRAND_STRAND_ZIPS;

const SC_MOUNT_PLEASANT_WATER_ZIPS = SC_CHARLESTON_ZIPS;

const SC_PIEDMONT_GAS_ZIPS = ["293", "296", "297"];

const CAROLINAS_PIEDMONT_GAS_ZIPS = [...NC_PIEDMONT_GAS_ZIPS, ...SC_PIEDMONT_GAS_ZIPS];

const SC_DOMINION_ELECTRIC_ZIPS = SC_STATE_ZIPS;

const SC_DOMINION_GAS_ZIPS = SC_STATE_ZIPS;

const SC_DUKE_ZIPS = ["290", "291", "293", "296", "297"];

const SC_SOUTHERN_CONNECTOR_ZIPS = ["296"];

const SC_SANTEE_COOPER_ZIPS = ["294", "295"];

const SC_BERKELEY_ELECTRIC_ZIPS = ["294"];

const SC_HORRY_ELECTRIC_ZIPS = SC_GRAND_STRAND_ZIPS;

const SC_BLUE_RIDGE_ELECTRIC_ZIPS = ["296"];

const SC_LAURENS_ELECTRIC_ZIPS = SC_UPSTATE_ZIPS;

const SC_MID_CAROLINA_ELECTRIC_ZIPS = SC_MIDLANDS_ZIPS;

const SC_PALMETTO_ELECTRIC_ZIPS = ["299"];

const SC_YORK_ELECTRIC_ZIPS = SC_YORK_LANCASTER_ZIPS;

const SC_SANTEE_ELECTRIC_ZIPS = ["290", "291", "295"];

const OH_AEP_ZIPS = ["430", "431", "432", "433", "434", "435", "436", "437", "438", "439", "440", "441", "442", "443", "444", "445", "446", "447", "448", "449", "450", "451", "452", "453", "454", "455", "456"];

const OH_COLUMBIA_GAS_ZIPS = ["430", "431", "432", "433", "434", "435", "436", "437", "438", "439", "440", "441", "442", "443", "444", "445", "446", "447", "448", "449", "450", "451", "452", "453", "454", "455", "456", "457", "458"];

const OH_TURNPIKE_ZIPS = ["434", "435", "436", "440", "441", "442", "443", "444", "445", "448", "449"];

const OH_FIRSTENERGY_ZIPS = ["434", "435", "436", "440", "441", "442", "443", "444", "445", "446", "447", "448", "449"];

const OH_DUKE_ZIPS = ["450", "451", "452"];

const OH_AES_ZIPS = ["453", "454", "455", "458"];

const OH_ENBRIDGE_GAS_ZIPS = ["440", "441", "442", "443", "444", "445", "446", "447", "448", "449"];

const OH_CENTERPOINT_GAS_ZIPS = ["453", "454", "455"];

const OH_COLUMBUS_REGION_ZIPS = ["430", "431", "432"];

const OH_CLEVELAND_REGION_ZIPS = ["440", "441", "442", "443"];

const OH_CINCINNATI_REGION_ZIPS = ["450", "451", "452"];

const OH_TOLEDO_REGION_ZIPS = ["434", "435", "436"];

const OH_RUMPKE_ZIPS = ["430", "431", "432", "433", "450", "451", "452", "453", "454", "455", "456"];

const VA_FAIRFAX_WATER_ZIPS = [
  "20120", "20121", "20124", "20151", "20152", "20153",
  "22003", "22015", "22027", "22030", "22031", "22032", "22033", "22034", "22035", "22039", "22041", "22042", "22043", "22044", "22046", "22060", "22066", "22079",
  "22101", "22102", "22124", "22150", "22151", "22152", "22153", "22180", "22181", "22182", "22183", "22185", "22199",
  "22303", "22306", "22307", "22308", "22309", "22310", "22312", "22315",
];

const CT_SCG_ZIPS = [
  "06405", "06413", "06417", "06426", "06437", "06443", "06460", "06461", "06471", "06472", "06473", "06475", "06477", "06498",
  "06510", "06511", "06512", "06513", "06514", "06515", "06516", "06517", "06518", "06519", "06520", "06525", "06530", "06531", "06532", "06533", "06534", "06535", "06536", "06537", "06538", "06540",
  "06604", "06605", "06606", "06607", "06608", "06610", "06611", "06612", "06614", "06615", "06650", "06673", "06699",
  "06824", "06825", "06828", "06880", "06881", "06883", "06890",
];

const CT_AQUARION_ZIP_PREFIXES = ["063", "064", "066", "067", "068", "069"];

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
    sourceUrl: "https://secure.peco.com/CustomerServices/service/landing",
    note: "PECO coverage is concentrated in Philadelphia and surrounding southeastern Pennsylvania suburbs; final service availability should be confirmed by address.",
  },
  {
    slug: "pa-ezpass",
    zipCodes: ["150", "151", "152", "156", "159", "160", "161", "170", "171", "172", "173", "180", "181", "183", "189", "190", "191", "194"],
    sourceUrl: "https://www.paturnpike.com/e-zpass/personal-account",
    note: "Pennsylvania Turnpike E-ZPass is modeled against major Turnpike corridor ZIP prefixes; E-ZPass account portability may still make it relevant outside these prefixes.",
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
    sourceUrl: "https://opc.maryland.gov/Consumer-Learning/Utility-Rates-and-Basics/BGE",
    note: "BGE coverage is centered on Baltimore and surrounding central Maryland counties; ZIP prefixes are a prefilter and service should be confirmed by address.",
  },
  {
    slug: "pepco",
    zipCodes: ["200", "203", "204", "205", "207", "208", "209"],
    sourceUrl: "https://opc.maryland.gov/Consumer-Learning/Utility-Rates-and-Basics/Pepco",
    note: "Pepco covers the District of Columbia and nearby Maryland suburbs; ZIP prefixes are a prefilter and service should be confirmed by address.",
  },
  {
    slug: "seattle-city-light",
    zipCodes: ["98055", "98056", "98057", "98058", "98059", "981"],
    sourceUrl: "https://www.seattle.gov/city-light",
    note: "Seattle City Light serves Seattle and selected nearby King County communities; exact 9805x ZIPs catch Renton-area service while 981 covers the Seattle core.",
  },
  {
    slug: "good-to-go",
    zipCodes: ["980", "981", "982", "983", "984"],
    sourceUrl: "https://wsdot.wa.gov/travel/roads-bridges/toll-roads-bridges-tunnels/good-go-accounts-passes",
    note: "Good To Go! is Washington's toll account system; ZIP prefixes are Puget Sound toll-corridor prefilters rather than statewide residential coverage.",
  },
  {
    slug: "pse-wa",
    zipCodes: ["980", "981", "982", "983", "984", "985", "989"],
    sourceUrl: "https://www.pse.com/en/Customer-Service/pse-locations-2",
    note: "Puget Sound Energy electric and gas coverage spans Puget Sound and selected central Washington service areas; ZIP prefixes are a prefilter and require address confirmation.",
  },

  // Arkansas
  {
    slug: "entergy-ar",
    zipCodes: AR_STATE_ZIPS,
    sourceUrl: "https://www.entergy.com/communities/areas",
    note: "Entergy Arkansas has broad county-level coverage across Arkansas; ZIPs are statewide prefilters and service should be confirmed by address.",
  },
  {
    slug: "swepco-ar",
    zipCodes: AR_SWEPCO_ZIPS,
    sourceUrl: "https://www.swepco.com/account/service/start-stop-transfer",
    note: "SWEPCO Arkansas service is concentrated in western and northwest Arkansas; ZIPs are prefilters and electric service should be confirmed by address.",
  },
  {
    slug: "oge-ar",
    zipCodes: AR_OGE_ZIPS,
    sourceUrl: "https://www.oge.com/web/portal/label_ord/residential/startstoptransfer/overview",
    note: "OG&E's Arkansas service area is concentrated around Fort Smith and nearby western Arkansas communities; confirm by service address.",
  },
  {
    slug: "summit-utilities-ar",
    zipCodes: AR_SUMMIT_GAS_ZIPS,
    sourceUrl: "https://summitutilities.com/contact/start-stop-transfer-service",
    note: "Summit Utilities Arkansas is a broad natural-gas provider, but service must be verified by address.",
  },
  {
    slug: "black-hills-energy-ar",
    zipCodes: AR_BLACK_HILLS_GAS_ZIPS,
    sourceUrl: "https://www.blackhillsenergy.com/app-startstop/service-select",
    note: "Black Hills Energy Arkansas serves selected natural gas communities; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "arkansas-oklahoma-gas",
    zipCodes: AR_AOG_ZIPS,
    sourceUrl: "https://www.aogc.com/RequestService",
    note: "Arkansas Oklahoma Gas serves selected western Arkansas counties; ZIPs are prefilters and gas service should be confirmed by address.",
  },
  {
    slug: "carroll-electric-ar",
    zipCodes: AR_CARROLL_ELECTRIC_ZIPS,
    sourceUrl: "https://www.carrollecc.com/apply-for-service",
    note: "Carroll Electric Cooperative serves selected Northwest Arkansas addresses; confirm by service address.",
  },
  {
    slug: "first-electric-ar",
    zipCodes: AR_FIRST_ELECTRIC_ZIPS,
    sourceUrl: "https://www.firstelectric.coop/services/electrical-service/set-up-new-service",
    note: "First Electric Cooperative serves portions of central and southeast Arkansas; confirm by service address.",
  },
  {
    slug: "central-ar-water",
    zipCodes: AR_CENTRAL_WATER_ZIPS,
    sourceUrl: "https://carkw.com/customer-service/start-or-stop-service/",
    note: "Central Arkansas Water is modeled with Little Rock-area ZIP prefilters; exact water service should be confirmed by address.",
  },
  {
    slug: "north-little-rock-electric",
    zipCodes: AR_NORTH_LITTLE_ROCK_ZIPS,
    sourceUrl: "https://nlrelectric.com/forms/",
    note: "North Little Rock Electric is a municipal utility; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "conway-corp-electric",
    zipCodes: AR_CONWAY_ZIPS,
    sourceUrl: "https://conwaycorp.com/sign-up-for-a-service/",
    note: "Conway Corporation is city-scoped for municipal utility accounts; confirm service by address.",
  },
  {
    slug: "springdale-water-utilities",
    zipCodes: AR_NWA_ZIPS,
    sourceUrl: "https://springdalewaterar.gov/new-customer/",
    note: "Springdale Water Utilities serves selected Springdale-area water and wastewater addresses.",
  },
  {
    slug: "bentonville-utilities",
    zipCodes: AR_NWA_ZIPS,
    sourceUrl: "https://www.bentonvillear.com/565/Utility-Service",
    note: "City of Bentonville Utilities is municipal and address-specific for electric, water, wastewater, and solid waste accounts.",
  },
  {
    slug: "fayetteville-utilities",
    zipCodes: AR_NWA_ZIPS,
    sourceUrl: "https://www.fayetteville-ar.gov/1368/New-Water-and-Sewer-Services",
    note: "Fayetteville utility accounts include water, sewer, trash, and recycling; service should be confirmed by address.",
  },
  {
    slug: "fort-smith-utilities",
    zipCodes: AR_FORT_SMITH_ZIPS,
    sourceUrl: "https://www.fortsmithar.gov/resident-services/water-utilities",
    note: "Fort Smith utilities are municipal and address-specific for water, sewer, and sanitation billing.",
  },
  {
    slug: "rogers-water-utilities",
    zipCodes: AR_NWA_ZIPS,
    sourceUrl: "https://www.rogerswaterar.gov/residential/services-and-information/start-or-stop-service/",
    note: "Rogers Water Utilities serves selected Rogers-area water addresses; confirm service by address.",
  },
  {
    slug: "aps-az",
    zipCodes: AZ_APS_ZIPS,
    sourceUrl: "https://www.aps.com/en/Residential/Service-Plans/Service-Area-Maps",
    note: "Arizona Public Service serves central and northern Arizona; ZIPs are prefilters and electric service should be confirmed by address.",
  },
  {
    slug: "srp-az",
    zipCodes: AZ_SRP_ZIPS,
    sourceUrl: "https://www.srpnet.com/about/service-area-territory",
    note: "Salt River Project electric service is concentrated in the Phoenix metro; exact electric and water service should be confirmed by address.",
  },
  {
    slug: "pge-or",
    zipCodes: OR_PGE_ZIPS,
    sourceUrl: "https://portlandgeneral.com/start-stop-move",
    note: "Portland General Electric serves the Portland metro area and northern Willamette Valley; service should be confirmed by address.",
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
    sourceUrl: "https://www.phila.gov/services/water-gas-utilities/become-a-water-customer/",
    note: "Philadelphia Water Department customer setup is city-scoped to Philadelphia ZIP ranges.",
  },
  {
    slug: "chicago-water",
    zipCodes: ["606"],
    sourceUrl: "https://www.chicago.gov/water",
    note: "Chicago Water Department is city-scoped to Chicago ZIP ranges.",
  },
  {
    slug: "columbus-water",
    zipCodes: OH_COLUMBUS_REGION_ZIPS,
    sourceUrl: "https://www.columbus.gov/Services/Columbus-Water-Power/Start-New-Utility-Service",
    note: "Columbus Water & Power is modeled with central Ohio ZIP prefixes as prefilters; municipal water, sewer, and power service should be confirmed by address.",
  },
  {
    slug: "cincy-water",
    zipCodes: OH_CINCINNATI_REGION_ZIPS,
    sourceUrl: "https://www.cincinnati-oh.gov/water/moving-or-selling-your-property1/",
    note: "Greater Cincinnati Water Works is modeled with southwest Ohio ZIP prefixes as prefilters; exact water account coverage should be confirmed by address.",
  },
  {
    slug: "denver-water",
    zipCodes: CO_DENVER_WATER_ZIPS,
    sourceUrl: "https://www.denverwater.org/residential/services-and-information/start-or-stop-service",
    note: "Denver Water covers Denver and selected nearby service areas; exact ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "xcel-energy",
    zipCodes: CO_XCEL_ZIPS,
    sourceUrl: "https://corporate.my.xcelenergy.com/s/energy/service-areas/colorado",
    note: "Xcel Energy Colorado electric and gas coverage is address-specific; exact ZIPs are Front Range prefilters from Colorado service-area evidence.",
  },
  {
    slug: "expresstoll",
    zipCodes: CO_EXPRESSTOLL_ZIPS,
    sourceUrl: "https://www.expresstoll.com/",
    note: "ExpressToll is the Colorado toll account surface for E-470, Northwest Parkway, and CDOT Express Lanes; ZIPs are Denver and Front Range corridor prefilters.",
  },
  {
    slug: "bhe-co-gas",
    zipCodes: CO_BLACK_HILLS_ZIPS,
    sourceUrl: "https://www.blackhillsenergy.com/app-startstop/service-select",
    note: "Black Hills Energy Colorado service is concentrated in selected southern Colorado communities; exact ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "slc-water-ut",
    zipCodes: UT_SLC_PUBLIC_UTILITIES_ZIPS,
    sourceUrl: "https://www.slc.gov/utilities/",
    note: "Salt Lake City Department of Public Utilities is city-scoped; exact ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "phoenix-water",
    zipCodes: AZ_PHOENIX_CITY_ZIPS,
    sourceUrl: "https://www.phoenix.gov/residents/water-sewer.html",
    note: "City of Phoenix water, sewer, trash, and city services billing are scoped to eligible Phoenix addresses.",
  },
  {
    slug: "mesa-utilities",
    zipCodes: ["852"],
    sourceUrl: "https://www.mesaaz.gov/Utilities",
    note: "City of Mesa utilities include electric, natural gas, water, wastewater, trash, and recycling in address-specific municipal service areas.",
  },
  {
    slug: "lvvwd",
    zipCodes: NV_LAS_VEGAS_VALLEY_ZIPS,
    sourceUrl: "https://www.lvvwd.com/customer-service/water-service/start-stop-service.html",
    note: "Las Vegas Valley Water District uses Las Vegas Valley ZIP prefilters; retail water service should be confirmed by address.",
  },
  {
    slug: "portland-water-or",
    zipCodes: OR_PORTLAND_METRO_ZIPS,
    sourceUrl: "https://www.portland.gov/water/customer-service/pay-your-utility-bill/start-stop-or-transfer-service",
    note: "City of Portland utility service is municipal and address-specific for water, sewer, and stormwater accounts.",
  },
  {
    slug: "spu-wa",
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
    zipCodes: NC_RALEIGH_SERVICE_ZIPS,
    sourceUrl: "https://raleighnc.gov/water-and-sewer/services/start-stop-or-transfer-utility-services",
    note: "Raleigh Water serves Raleigh and nearby partner municipalities; exact ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "charlotte-water",
    zipCodes: NC_CHARLOTTE_ZIPS,
    sourceUrl: "https://www.charlottenc.gov/water/Customer-Care/Start-Stop-Service",
    note: "Charlotte Water is modeled with Charlotte-area ZIP prefilters and should be confirmed by service address.",
  },
  {
    slug: "fairfax-water",
    zipCodes: VA_FAIRFAX_WATER_ZIPS,
    sourceUrl: "https://www.fairfaxwater.org/start-service",
    note: "Fairfax Water is concentrated in Fairfax County and nearby Northern Virginia service ZIPs; exact ZIPs are prefilters and water service should be confirmed by address.",
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
    zipCodes: AZ_TUCSON_ZIPS,
    sourceUrl: "https://www.tucsonaz.gov/Departments/Water",
    note: "Tucson Water is concentrated in Tucson and southern Pima County ZIP ranges; service should be confirmed by address.",
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
    zipCodes: ["910", "911", "912", "913", "914", "915", "916", "917", "918", "922", "923", "924", "925", "926", "927", "928", "930", "931", "932", "933", "934", "935"],
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
    slug: "breezeby-electronic-tolling",
    zipCodes: OR_BREEZEBY_ZIPS,
    sourceUrl: "https://www.portofhoodriver.com/about-breezeby-electronic-bridge-tolling",
    note: "BreezeBy is tied to the Hood River and Cascade Locks Columbia River bridge toll corridors.",
  },
  {
    slug: "pacific-power-or",
    zipCodes: OR_PACIFIC_POWER_ZIPS,
    sourceUrl: "https://www.pacificpower.net/my-account/start-stop-move.html",
    note: "Pacific Power uses broad Oregon ZIP prefilters outside PGE's core footprint; service should be confirmed by address.",
  },
  {
    slug: "idaho-power-or",
    zipCodes: OR_IDAHO_POWER_ZIPS,
    sourceUrl: "https://www.idahopower.com/accounts-service/start-stop-transfer/",
    note: "Idaho Power's Oregon service area is concentrated in eastern Oregon and should be confirmed by address.",
  },
  {
    slug: "cascade-wa-gas",
    zipCodes: PNW_CASCADE_GAS_ZIPS,
    sourceUrl: "https://www.cngc.com/customer-service/start-stop-or-transfer-service/",
    note: "Cascade Natural Gas serves selected Washington and Oregon communities; ZIP prefixes are broad prefilters and require service-address confirmation.",
  },
  {
    slug: "nw-natural",
    zipCodes: PNW_NW_NATURAL_ZIPS,
    sourceUrl: "https://www.nwnatural.com/gas-availability",
    note: "NW Natural serves Oregon and Southwest Washington; ZIP prefixes are regional prefilters and require address-based gas availability checks.",
  },
  {
    slug: "avista-utilities-or-gas",
    zipCodes: OR_AVISTA_GAS_ZIPS,
    sourceUrl: "https://www.myavista.com/your-account/moving",
    note: "Avista Oregon gas service is a narrow prefilter and must be confirmed by service address.",
  },
  {
    slug: "eweb",
    zipCodes: OR_EUGENE_ZIPS,
    sourceUrl: "https://www.eweb.org/start-stop",
    note: "EWEB serves Eugene-area electric and water customers; service should be confirmed by address near utility boundaries.",
  },
  {
    slug: "springfield-utility-board",
    zipCodes: OR_EUGENE_ZIPS,
    sourceUrl: "https://www.subutil.com/customer-service/start-stop-service/",
    note: "Springfield Utility Board serves Springfield electric and water customers; exact service is address-specific.",
  },
  {
    slug: "central-lincoln-pud",
    zipCodes: OR_COASTAL_ZIPS,
    sourceUrl: "https://clpud.org/customer-information/start-or-stop-service/",
    note: "Central Lincoln PUD uses coastal Oregon ZIP prefilters and should be confirmed by address.",
  },
  {
    slug: "tillamook-pud",
    zipCodes: OR_COASTAL_ZIPS,
    sourceUrl: "https://www.tpud.org/customer-service/start-or-stop-service/",
    note: "Tillamook PUD service is regional on the Oregon coast and should be confirmed by address.",
  },
  {
    slug: "oregon-trail-electric",
    zipCodes: OR_EASTERN_ZIPS,
    sourceUrl: "https://www.otec.coop/",
    note: "Oregon Trail Electric Cooperative serves selected eastern Oregon addresses.",
  },
  {
    slug: "umatilla-electric",
    zipCodes: OR_EASTERN_ZIPS,
    sourceUrl: "https://www.umatillaelectric.com/member-services/start-stop-service/",
    note: "Umatilla Electric Cooperative is northeastern Oregon scoped and should be confirmed by address.",
  },
  {
    slug: "consumers-power-or",
    zipCodes: ["973", "974"],
    sourceUrl: "https://cpi.coop/service/stop-service",
    note: "Consumers Power Inc. serves selected Oregon zones; exact service should be confirmed by address.",
  },
  {
    slug: "lane-electric",
    zipCodes: OR_EUGENE_ZIPS,
    sourceUrl: "https://www.laneelectric.com/member-services/new-member-guide/",
    note: "Lane Electric Cooperative serves rural Lane County areas and should be confirmed by address.",
  },
  {
    slug: "trimet",
    zipCodes: ["970", "971", "972", "973", "974"],
    sourceUrl: "https://trimet.org/about/coverage.htm",
    note: "TriMet serves the Portland metro area including Multnomah, Washington, and Clackamas counties.",
  },

  // ── Nevada / Southwest ──
  {
    slug: "city-of-salem-utilities",
    zipCodes: OR_SALEM_ZIPS,
    sourceUrl: "https://www.cityofsalem.net/community/household/water-utilities/utility-payments-and-your-utility-account/manage-your-city-of-salem-utility-service-account",
    note: "City of Salem utility account workflows are municipal and should be confirmed by address.",
  },
  {
    slug: "city-of-bend-water",
    zipCodes: OR_CENTRAL_ZIPS,
    sourceUrl: "https://bendoregon.gov/service/water-sewer-start-or-stop-service/",
    note: "City of Bend water and sewer service is municipal and address-specific.",
  },
  {
    slug: "medford-water",
    zipCodes: OR_MEDFORD_ZIPS,
    sourceUrl: "https://www.medfordwater.org/services/customer-service/",
    note: "Medford Water is a regional water provider and should be confirmed by service address.",
  },
  {
    slug: "tualatin-valley-water",
    zipCodes: OR_TVWD_HILLSBORO_ZIPS,
    sourceUrl: "https://www.tvwd.org/district/page/startstop-service-interim-billing",
    note: "Tualatin Valley Water District serves selected Washington County-area addresses.",
  },
  {
    slug: "hillsboro-utility-billing",
    zipCodes: OR_TVWD_HILLSBORO_ZIPS,
    sourceUrl: "https://www.hillsboro-oregon.gov/services/utility-billing/start-or-stop-service",
    note: "Hillsboro utility billing is city-scoped and should be confirmed by address.",
  },
  {
    slug: "gresham-utility-services",
    zipCodes: OR_GRESHAM_ZIPS,
    sourceUrl: "https://www.greshamoregon.gov/services/utilities/stop-or-start-utility-services/",
    note: "Gresham water, wastewater, and stormwater utility service should be confirmed by address.",
  },
  {
    slug: "nv-energy",
    zipCodes: NV_ENERGY_ZIPS,
    sourceUrl: "https://www.nvenergy.com/my-account/ss-landing",
    note: "NV Energy serves most Nevada electric customers plus selected gas customers; ZIPs are broad prefilters and service should be confirmed by address.",
  },
  {
    slug: "southwest-gas",
    zipCodes: AZ_NV_SOUTHWEST_GAS_ZIPS,
    sourceUrl: "https://www.swgas.com/en/service-territory",
    note: "Southwest Gas serves Arizona and Nevada natural gas territories; ZIPs are broad prefilters and service should be confirmed by address.",
  },
  {
    slug: "tmwa",
    zipCodes: NV_RENO_SPARKS_ZIPS,
    sourceUrl: "https://tmwa.com/start-stop-or-transfer-service/",
    note: "Truckee Meadows Water Authority serves Reno-Sparks-area water addresses; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "henderson-utility-services",
    zipCodes: ["890", "891"],
    sourceUrl: "https://www.cityofhenderson.com/government/departments/utility-services/businesses/start-stop-and-transfer-service",
    note: "City of Henderson utility services are municipal and address-specific for water and sewer accounts.",
  },
  {
    slug: "north-las-vegas-utilities",
    zipCodes: ["890", "891"],
    sourceUrl: "https://payutil.cityofnorthlasvegas.com/",
    note: "City of North Las Vegas utility billing and service requests are address-specific within city service boundaries.",
  },
  {
    slug: "clark-county-water-reclamation",
    zipCodes: NV_SOUTHERN_ZIPS,
    sourceUrl: "https://www.cleanwaterteam.com/services",
    note: "Clark County Water Reclamation District sewer account applicability is separate from water service and should be confirmed by address.",
  },
  {
    slug: "reno-sewer-service",
    zipCodes: NV_RENO_SPARKS_ZIPS,
    sourceUrl: "https://www.reno.gov/government/departments/finance/sewer-service",
    note: "City of Reno sewer billing is separate from TMWA water service and should be confirmed by address.",
  },
  {
    slug: "carson-city-utility-billing",
    zipCodes: NV_CARSON_CITY_ZIPS,
    sourceUrl: "https://www.carson.org/business/water-and-sewer-services",
    note: "Carson City water, sewer, and stormwater utility billing is city-scoped and address-specific.",
  },
  {
    slug: "virgin-valley-water-district",
    zipCodes: ["890"],
    sourceUrl: "https://vvwdnv.com/sign-up-for-service",
    note: "Virgin Valley Water District serves Mesquite-area addresses; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "great-basin-water",
    zipCodes: NV_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://www.myutility.us/greatbasinwater",
    note: "Great Basin Water has multiple Nevada water and wastewater divisions; ZIPs are broad prefilters and service must be confirmed by address.",
  },
  {
    slug: "republic-services-southern-nevada",
    zipCodes: NV_SOUTHERN_ZIPS,
    sourceUrl: "https://www.republicservices.com/municipality/southern-nevada",
    note: "Republic Services of Southern Nevada serves address-specific municipal trash and recycling areas in Southern Nevada.",
  },
  {
    slug: "wm-nevada",
    zipCodes: NV_WM_ZIPS,
    sourceUrl: "https://www.wm.com/us/en/location/nv",
    note: "WM Nevada service varies by locality and should be confirmed by address, especially outside Southern Nevada Republic service areas.",
  },
  {
    slug: "valley-electric-association",
    zipCodes: ["890"],
    sourceUrl: "https://www.vea.coop/member-services/start-stop/",
    note: "Valley Electric Association serves selected southern Nevada cooperative addresses and should be confirmed by address.",
  },
  {
    slug: "overton-power-district",
    zipCodes: ["890"],
    sourceUrl: "https://opd5.com/customer-information/application-for-new-service/",
    note: "Overton Power District No. 5 serves Moapa Valley and Mesquite-area public-power addresses; confirm by address.",
  },
  {
    slug: "lincoln-county-power-district",
    zipCodes: ["890"],
    sourceUrl: "https://www.lcpd1.com/form/start-or-stop-service",
    note: "Lincoln County Power District No. 1 serves selected Lincoln County electric addresses; ZIPs are prefilters.",
  },
  {
    slug: "mt-wheeler-power",
    zipCodes: ["893", "898"],
    sourceUrl: "https://www.mwpower.net/new-service-upgrade-request",
    note: "Mt. Wheeler Power serves selected eastern Nevada addresses; service should be confirmed by address.",
  },
  {
    slug: "wells-rural-electric",
    zipCodes: ["898"],
    sourceUrl: "https://www.wrec.coop/member-services/start-stop-transfer-service/",
    note: "Wells Rural Electric Company serves selected northeastern Nevada cooperative addresses; confirm by address.",
  },
  {
    slug: "boulder-city-utilities",
    zipCodes: ["890"],
    sourceUrl: "https://bcnv.org/321/Utilities---Billing",
    note: "Boulder City municipal utilities are city-scoped and address-specific for electric, water, wastewater, and billing.",
  },
  {
    slug: "unisource-gas-az",
    zipCodes: AZ_UNISOURCE_ZIPS,
    sourceUrl: "https://www.uesaz.com/im-moving/",
    note: "UniSource natural gas service is limited to selected Arizona communities; confirm availability by service address.",
  },
  {
    slug: "tucson-electric-power",
    zipCodes: AZ_TUCSON_ZIPS,
    sourceUrl: "https://www.tep.com/service-territory/",
    note: "Tucson Electric Power serves Tucson and surrounding areas; ZIPs are prefilters and electric service should be confirmed by address.",
  },
  {
    slug: "unisource-electric-az",
    zipCodes: AZ_UNISOURCE_ZIPS,
    sourceUrl: "https://www.uesaz.com/im-moving/",
    note: "UniSource electric service is territory-specific in selected Arizona communities; confirm availability by address.",
  },
  {
    slug: "epcor-water-az",
    zipCodes: AZ_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://www.epcor.com/us/en/az/account/start-service.html",
    note: "EPCOR Water Arizona serves non-contiguous water and wastewater districts; ZIPs are broad prefilters and service must be confirmed by address.",
  },
  {
    slug: "arizona-water-company",
    zipCodes: AZ_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://www.azwater.com/development/service-area/",
    note: "Arizona Water Company operates multiple non-contiguous Arizona water systems; ZIPs are broad prefilters and service must be confirmed by address.",
  },
  {
    slug: "liberty-utilities-az-water",
    zipCodes: AZ_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://libertyutilities.com/residential/about/what-we-do/water-and-wastewater.html",
    note: "Liberty Utilities Arizona water and wastewater service is community-specific; ZIPs are broad prefilters and service must be confirmed by address.",
  },
  {
    slug: "trico-electric",
    zipCodes: AZ_TRICO_ZIPS,
    sourceUrl: "https://trico.coop/start-stop-transfer-service/",
    note: "Trico Electric Cooperative serves selected Tucson-area addresses; cooperative electric service should be confirmed by address.",
  },
  {
    slug: "mohave-electric",
    zipCodes: AZ_MOHAVE_ELECTRIC_ZIPS,
    sourceUrl: "https://www.mohaveelectric.com/member-service/apply-for-service/",
    note: "Mohave Electric Cooperative serves selected northwest Arizona addresses around Mohave County; confirm service by address.",
  },
  {
    slug: "ssvec",
    zipCodes: AZ_SSVEC_ZIPS,
    sourceUrl: "https://www.ssvec.org/services/new-service.php",
    note: "Sulphur Springs Valley Electric Cooperative serves southeastern Arizona communities; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "chandler-water",
    zipCodes: ["852"],
    sourceUrl: "https://www.chandleraz.gov/residents/utility-services",
    note: "City of Chandler utility services include water, wastewater, trash, and recycling; account eligibility should be confirmed by address.",
  },
  {
    slug: "tempe-water-services",
    zipCodes: ["852"],
    sourceUrl: "https://www.tempe.gov/i-want-to/start-stop-water-service",
    note: "City of Tempe customer services cover water, sewer, and solid waste start, transfer, and stop workflows; confirm by address.",
  },
  {
    slug: "scottsdale-water",
    zipCodes: ["852"],
    sourceUrl: "https://www.scottsdaleaz.gov/utilities/establish-service",
    note: "City of Scottsdale utility service requires address confirmation before establishing water or related city utility service.",
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
    sourceUrl: "https://www.eversource.com/residential/about/our-company/service-territory",
    note: "Eversource serves Massachusetts and Connecticut electric/gas territories; ZIP prefixes are a prefilter and service should be confirmed by address.",
  },
  {
    slug: "eversource-nh",
    zipCodes: ["030", "031", "032", "033", "034", "035", "036", "037", "038"],
    sourceUrl: "https://www.eversource.com/residential/services/communities-we-serve",
    note: "Eversource New Hampshire serves many, but not all, New Hampshire communities; ZIP prefixes are a prefilter and service should be confirmed by address.",
  },
  {
    slug: "national-grid-ma",
    zipCodes: ["010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027"],
    sourceUrl: "https://www.nationalgridus.com/MA-Home/Start-or-Transfer-Service",
    note: "National Grid Massachusetts provides electric and natural gas service in selected Massachusetts communities; ZIP prefixes are a prefilter and service should be confirmed by address.",
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
    zipCodes: CT_SCG_ZIPS,
    sourceUrl: "https://www.soconngas.com/moving",
    note: "Southern Connecticut Gas serves a defined greater New Haven, Bridgeport, and shoreline gas footprint; exact ZIPs are prefilters and availability should be confirmed by address.",
  },
  {
    slug: "aquarion-ct",
    zipCodes: CT_AQUARION_ZIP_PREFIXES,
    sourceUrl: "https://www.aquarionwater.com/customer-care/start-or-stop-service",
    note: "Aquarion Connecticut has a fragmented water/wastewater footprint; ZIP prefixes narrow the UI surface but service must be confirmed by address.",
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
    sourceUrl: "https://www.dominionenergy.com/en/Virginia/Start-Stop-Service",
    note: "Dominion Energy Virginia electric service is not statewide despite broad ZIP prefilters; final service availability should be confirmed by address.",
  },
  {
    slug: "delmarva-power-de",
    zipCodes: ["197", "198", "199", "216", "218", "219"],
    sourceUrl: "https://www.delmarva.com/contact-us/service-territory/",
    note: "Delmarva Power serves Delaware and Maryland's Eastern Shore for electric service; ZIP prefixes are a prefilter and require address confirmation.",
  },
  {
    slug: "wssc-md",
    zipCodes: MD_WSSC_ZIPS,
    sourceUrl: "https://www.wsscwater.com/overview",
    note: "WSSC Water serves Montgomery and Prince George's counties; exact ZIPs are county-scoped prefilters and require address confirmation.",
  },
  {
    slug: "chpk-de-gas",
    zipCodes: ["197", "198", "199", "216", "218", "219"],
    sourceUrl: "https://www.chpkgas.com/about/service-areas/",
    note: "Chesapeake Utilities serves Delaware and selected Maryland Eastern Shore communities; ZIP prefixes are a prefilter and require address confirmation.",
  },
  {
    slug: "ppl",
    zipCodes: ["170", "171", "172", "173", "174", "175", "176", "177", "178", "179", "180", "181", "182", "183", "184", "185", "186", "187", "188"],
    sourceUrl: "https://pplelectric.com/site/My-Account/Start-Stop-Move-Service",
    note: "PPL Electric Utilities serves central and eastern Pennsylvania for electric service; ZIP prefixes are a prefilter and service availability should be confirmed by address.",
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
    zipCodes: NC_DUKE_PREFILTER_ZIPS,
    sourceUrl: "https://www.duke-energy.com/start-stop-move/landing",
    note: "Duke Energy North Carolina covers Duke Energy Carolinas and Duke Energy Progress territories; ZIP prefixes are broad prefilters and service should be confirmed by address.",
  },
  {
    slug: "nc-quick-pass",
    zipCodes: NC_QUICK_PASS_ZIPS,
    sourceUrl: "https://www.ncquickpass.com/open-account/",
    note: "NC Quick Pass is modeled against Triangle, Monroe, and I-77 toll-corridor ZIPs; account relevance depends on toll-facility use.",
  },
  {
    slug: "dominion-energy-nc",
    zipCodes: NC_DOMINION_ELECTRIC_ZIPS,
    sourceUrl: "https://www.dominionenergy.com/en/North-Carolina/Start-Stop-Service",
    note: "Dominion Energy North Carolina electric service is concentrated in northeastern North Carolina; exact ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "energyunited",
    zipCodes: NC_ENERGYUNITED_ZIPS,
    sourceUrl: "https://www.energyunited.com/member-guide/",
    note: "EnergyUnited serves selected cooperative electric addresses across portions of multiple North Carolina counties.",
  },
  {
    slug: "blue-ridge-energy",
    zipCodes: NC_BLUE_RIDGE_ENERGY_ZIPS,
    sourceUrl: "https://www.blueridgeenergy.com/residential/apply-for-service",
    note: "Blue Ridge Energy ZIPs are northwestern North Carolina prefilters; cooperative service should be confirmed by address.",
  },
  {
    slug: "brunswick-electric",
    zipCodes: NC_BRUNSWICK_ELECTRIC_ZIPS,
    sourceUrl: "https://www.bemc.org/name-change-transfer-service/",
    note: "BEMC serves selected southeastern North Carolina addresses; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "piedmont-carolinas",
    zipCodes: CAROLINAS_PIEDMONT_GAS_ZIPS,
    sourceUrl: "https://www.piedmontng.com/home/start-stop-or-move",
    note: "Piedmont Natural Gas service is fragmented across Carolinas markets and should be confirmed by address.",
  },
  {
    slug: "psnc",
    zipCodes: NC_ENBRIDGE_GAS_ZIPS,
    sourceUrl: "https://www.enbridgegas.com/north-carolina/start-stop-service",
    note: "Enbridge Gas North Carolina, formerly PSNC/Dominion Energy gas, uses broad ZIP prefilters and address-level service confirmation.",
  },
  {
    slug: "frontier-natural-gas",
    zipCodes: NC_FRONTIER_GAS_ZIPS,
    sourceUrl: "https://www.frontiernaturalgas.com/natural-gas-conversion/service-area/",
    note: "Frontier Natural Gas serves selected North Carolina communities and should be confirmed by service address.",
  },
  {
    slug: "duke-fl",
    zipCodes: FL_DUKE_ENERGY_ZIPS,
    sourceUrl: "https://www.duke-energy.com/start-stop-move/landing",
    note: "Duke Energy Florida coverage is concentrated in central, west-central, and north-central Florida; ZIP prefixes are prefilters and service should be confirmed by address.",
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
    sourceUrl: "https://www.georgiapower.com/residential/manage-your-account/start-stop-move.html",
    note: "Georgia Power is a major Georgia electric utility; ZIP prefixes are broad prefilters and service should be confirmed by address.",
  },
  {
    slug: "peach-pass",
    zipCodes: GA_PEACH_PASS_ZIPS,
    sourceUrl: "https://peachpass.com/",
    note: "Peach Pass is modeled against Georgia Express Lanes corridor ZIPs; account relevance ultimately depends on toll-facility use.",
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
    zipCodes: GA_ATLANTA_CORE_ZIPS,
    sourceUrl: "https://atlantawatershed.org/start-my-service/",
    note: "Atlanta Watershed water and sewer service is modeled with Atlanta city ZIP prefilters and should be confirmed by service address.",
  },
  {
    slug: "gng",
    zipCodes: GA_NATURAL_GAS_MARKET_ZIPS,
    sourceUrl: "https://gng.com/shop-plans/movers",
    note: "Georgia Natural Gas is a retail marketer in Atlanta Gas Light gas-market areas; ZIP prefixes are prefilters and availability should be confirmed by address.",
  },
  {
    slug: "atlanta-gas-light",
    zipCodes: GA_NATURAL_GAS_MARKET_ZIPS,
    sourceUrl: "https://www.atlantagaslight.com/residential/start-stop-service.html",
    note: "Atlanta Gas Light is the gas delivery utility for many Georgia service areas; ZIP prefixes are prefilters and service should be confirmed by address.",
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
    zipCodes: ["330", "331", "332"],
    sourceUrl: "https://www.miamidade.gov/global/water/my-account.page",
    note: "Miami-Dade Water and Sewer serves Miami-Dade County; ZIP prefixes are county-scoped and require address confirmation.",
  },
  {
    slug: "tampa-water",
    zipCodes: FL_TAMPA_CITY_ZIPS,
    sourceUrl: "https://www.tampa.gov/service/utility-service-starttransferstop-service",
    note: "City of Tampa Utilities covers water, wastewater, and solid-waste account workflows for city service addresses and selected nearby service areas; exact ZIPs are prefilters.",
  },
  {
    slug: "durham-water",
    zipCodes: NC_DURHAM_ZIPS,
    sourceUrl: "https://www.durhamnc.gov/4097/Start-Stop-Transfer",
    note: "Durham Water Management is city-scoped; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "charlotte-solid-waste",
    zipCodes: NC_CHARLOTTE_ZIPS,
    sourceUrl: "https://www.charlottenc.gov/Services/Trash-and-Recycling",
    note: "Charlotte Solid Waste Services is city-scoped; ZIPs are prefilters for resident collection support.",
  },
  {
    slug: "raleigh-solid-waste",
    zipCodes: NC_RALEIGH_SERVICE_ZIPS,
    sourceUrl: "https://raleighnc.gov/departments/solid-waste-services",
    note: "Raleigh Solid Waste Services is city-scoped; ZIPs are prefilters for resident collection support.",
  },
  {
    slug: "durham-solid-waste",
    zipCodes: NC_DURHAM_ZIPS,
    sourceUrl: "https://www.durhamnc.gov/832/Solid-Waste",
    note: "Durham Solid Waste Management is city-scoped; ZIPs are prefilters for resident collection support.",
  },
  {
    slug: "greensboro-water",
    zipCodes: NC_GREENSBORO_ZIPS,
    sourceUrl: "https://www.greensboro-nc.gov/departments/water-resources/customer-service-for-residents-and-businesses",
    note: "Greensboro Water Resources is city-scoped and should be confirmed by service address.",
  },
  {
    slug: "winston-salem-forsyth-utilities",
    zipCodes: NC_WINSTON_SALEM_ZIPS,
    sourceUrl: "https://www.cityofws.org/1237/Start-Stop-or-Transfer-Service",
    note: "Winston-Salem/Forsyth County Utilities service varies by address; ZIPs are prefilters.",
  },
  {
    slug: "winston-salem-solid-waste",
    zipCodes: NC_WINSTON_SALEM_ZIPS,
    sourceUrl: "https://www.cityofws.org/568/Solid-Waste-Collections",
    note: "Winston-Salem Solid Waste Collections is resident-service scoped; ZIPs are prefilters.",
  },
  {
    slug: "owasa",
    zipCodes: NC_OWASA_ZIPS,
    sourceUrl: "https://www.owasa.org/start-stop-move/",
    note: "OWASA serves the Carrboro-Chapel Hill service area and should be confirmed by address.",
  },
  {
    slug: "aqua-nc",
    zipCodes: NC_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://www.aquawater.com/start-or-stop-service",
    note: "Aqua North Carolina serves scattered water and wastewater systems; ZIP prefixes are prefilters and address confirmation is required.",
  },
  {
    slug: "carolina-water-nc",
    zipCodes: NC_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://www.mywater.us/north-carolina",
    note: "Carolina Water Service of North Carolina serves scattered systems; ZIP prefixes are prefilters and address confirmation is required.",
  },
  {
    slug: "old-north-state-water",
    zipCodes: NC_PRIVATE_WATER_ZIPS,
    sourceUrl: "https://onswc.com/customer-service/",
    note: "Old North State Water Company serves scattered water and wastewater communities; ZIP prefixes are prefilters and address confirmation is required.",
  },
  {
    slug: "charleston-water-sc",
    zipCodes: SC_CHARLESTON_ZIPS,
    sourceUrl: "https://www.charlestonwater.com/180/Open-or-Close-an-Account",
    note: "Charleston Water System uses Charleston-area ZIP prefilters; water and sewer service should be confirmed by service address.",
  },
  {
    slug: "greenville-water",
    zipCodes: SC_GREENVILLE_WATER_ZIPS,
    sourceUrl: "https://www.greenvillewater.com/customer-service/start-stop-move",
    note: "Greenville Water is modeled with Greenville-area ZIP prefilters and should be confirmed by service address.",
  },
  {
    slug: "columbia-water-sc",
    zipCodes: SC_COLUMBIA_WATER_ZIPS,
    sourceUrl: "https://columbiascwater.net/new-transfer-service/",
    note: "Columbia Water serves the Columbia/Midlands area; ZIP prefixes are prefilters and account eligibility should be confirmed by address.",
  },
  {
    slug: "spartanburg-water",
    zipCodes: SC_SPARTANBURG_WATER_ZIPS,
    sourceUrl: "https://www.spartanburgwater.org/manage-water-service",
    note: "Spartanburg Water uses Spartanburg-area ZIP prefilters and should be confirmed by address.",
  },
  {
    slug: "beaufort-jasper-water",
    zipCodes: SC_BEAUFORT_JASPER_WATER_ZIPS,
    sourceUrl: "https://www.bjwsa.org/167/StartStop-Services",
    note: "BJWSA serves selected Beaufort and Jasper service addresses; ZIPs are prefilters.",
  },
  {
    slug: "grand-strand-water",
    zipCodes: SC_GRAND_STRAND_WATER_ZIPS,
    sourceUrl: "https://www.gswsa.com/customer-service.cfm?page=44",
    note: "Grand Strand Water & Sewer Authority is modeled with Grand Strand/Horry ZIP prefilters and should be confirmed by address.",
  },
  {
    slug: "mount-pleasant-waterworks",
    zipCodes: SC_MOUNT_PLEASANT_WATER_ZIPS,
    sourceUrl: "https://www.mountpleasantwaterworks.com/customers/service___account_requests/start_or_stop_service.php",
    note: "Mount Pleasant Waterworks is town-scoped; ZIPs are prefilters and service should be confirmed by address.",
  },
  {
    slug: "palmetto-pass",
    zipCodes: SC_SOUTHERN_CONNECTOR_ZIPS,
    sourceUrl: "https://southernconnector.com/index.html",
    note: "Southern Connector / Palmetto Pass is tied to the Greenville-area I-185 toll corridor.",
  },
  {
    slug: "dominion-energy-sc",
    zipCodes: SC_DOMINION_ELECTRIC_ZIPS,
    sourceUrl: "https://www.dominionenergy.com/en/South-Carolina/Start-Stop-Service",
    note: "Dominion Energy South Carolina electric uses broad South Carolina ZIP prefilters; service should be confirmed by address.",
  },
  {
    slug: "duke-energy-sc",
    zipCodes: SC_DUKE_ZIPS,
    sourceUrl: "https://www.duke-energy.com/start-stop-move/landing",
    note: "Duke Energy South Carolina covers Duke Energy Carolinas and Progress territories; ZIPs are prefilters and address confirmation is required.",
  },
  {
    slug: "santee-cooper",
    zipCodes: SC_SANTEE_COOPER_ZIPS,
    sourceUrl: "https://www.santeecooper.com/residential/start-move-stop-service/",
    note: "Santee Cooper service is concentrated in coastal South Carolina and should be confirmed by address.",
  },
  {
    slug: "berkeley-electric",
    zipCodes: SC_BERKELEY_ELECTRIC_ZIPS,
    sourceUrl: "https://www.berkeleyelectric.coop/service-territory",
    note: "Berkeley Electric Cooperative serves selected Lowcountry addresses; ZIPs are prefilters.",
  },
  {
    slug: "horry-electric",
    zipCodes: SC_HORRY_ELECTRIC_ZIPS,
    sourceUrl: "https://horryelectric.com/services/electric-service/",
    note: "Horry Electric Cooperative serves selected Grand Strand addresses; ZIPs are prefilters.",
  },
  {
    slug: "blue-ridge-electric-sc",
    zipCodes: SC_BLUE_RIDGE_ELECTRIC_ZIPS,
    sourceUrl: "https://blueridge.coop/start-service",
    note: "Blue Ridge Electric Cooperative is an Upstate South Carolina provider; ZIPs are prefilters.",
  },
  {
    slug: "laurens-electric",
    zipCodes: SC_LAURENS_ELECTRIC_ZIPS,
    sourceUrl: "https://laurenselectric.com/my-account/start-service/",
    note: "Laurens Electric Cooperative serves selected Upstate South Carolina addresses; ZIPs are prefilters.",
  },
  {
    slug: "mid-carolina-electric",
    zipCodes: SC_MID_CAROLINA_ELECTRIC_ZIPS,
    sourceUrl: "https://www.mcecoop.com/my-account/start-service/",
    note: "Mid-Carolina Electric Cooperative requires address eligibility confirmation before service application.",
  },
  {
    slug: "palmetto-electric",
    zipCodes: SC_PALMETTO_ELECTRIC_ZIPS,
    sourceUrl: "https://palmetto.coop/startstop-service",
    note: "Palmetto Electric Cooperative serves selected Lowcountry addresses; ZIPs are prefilters.",
  },
  {
    slug: "york-electric",
    zipCodes: SC_YORK_ELECTRIC_ZIPS,
    sourceUrl: "https://www.yorkelectric.net/my-service/residential-accounts/start-residential-electric-service/",
    note: "York Electric Cooperative is modeled with York/Lancaster-area ZIP prefilters and should be confirmed by address.",
  },
  {
    slug: "santee-electric",
    zipCodes: SC_SANTEE_ELECTRIC_ZIPS,
    sourceUrl: "https://santee.org/service",
    note: "Santee Electric Cooperative is distinct from Santee Cooper and should be confirmed by address.",
  },
  {
    slug: "dominion-sc-gas",
    zipCodes: SC_DOMINION_GAS_ZIPS,
    sourceUrl: "https://www.dominionenergy.com/en/South-Carolina/Start-Stop-Service/Check-Availability",
    note: "Dominion Energy South Carolina gas uses broad ZIP prefilters; gas availability must be checked by address.",
  },
  {
    slug: "york-county-natural-gas",
    zipCodes: SC_YORK_LANCASTER_ZIPS,
    sourceUrl: "https://ycnga.com/start-stop-change-service/",
    note: "York County Natural Gas Authority serves selected York and nearby service addresses; ZIPs are prefilters.",
  },
  {
    slug: "fort-hill-natural-gas",
    zipCodes: SC_UPSTATE_ZIPS,
    sourceUrl: "https://www.fhnga.com/customer-support/start-stop-transfer.stml",
    note: "Fort Hill Natural Gas Authority serves selected Oconee, Pickens, and Anderson-area addresses; ZIPs are prefilters.",
  },
  {
    slug: "lancaster-county-natural-gas",
    zipCodes: SC_YORK_LANCASTER_ZIPS,
    sourceUrl: "https://lcngasc.com/",
    note: "Lancaster County Natural Gas Authority is modeled with Lancaster/York-area ZIP prefilters and should be confirmed by address.",
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
    slug: "ohio-turnpike-ezpass",
    zipCodes: OH_TURNPIKE_ZIPS,
    sourceUrl: "https://www.ohioturnpike.org/e-zpass/e-zpass-hub",
    note: "Ohio E-ZPass is a toll account surface for the Ohio Turnpike corridor; ZIP prefixes are a corridor prefilter and E-ZPass accounts may still be portable beyond them.",
  },
  {
    slug: "ohio-edison",
    zipCodes: OH_FIRSTENERGY_ZIPS,
    sourceUrl: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html",
    note: "FirstEnergy Ohio utilities include Ohio Edison, The Illuminating Company, and Toledo Edison; ZIP prefixes are northeast/northwest Ohio prefilters and service should be confirmed by address.",
  },
  {
    slug: "aep-ohio",
    zipCodes: OH_AEP_ZIPS,
    sourceUrl: "https://www.aepohio.com/account/service/start-stop-transfer",
    note: "AEP Ohio electric service is address-qualified; broad central/eastern/southern Ohio prefixes are used only as prefilters.",
  },
  {
    slug: "duke-oh",
    zipCodes: OH_DUKE_ZIPS,
    sourceUrl: "https://www.duke-energy.com/start-stop-move/landing",
    note: "Duke Energy Ohio serves southwest Ohio electric/gas customers; ZIP prefixes are Cincinnati-area prefilters and service should be confirmed by address.",
  },
  {
    slug: "aes-ohio",
    zipCodes: OH_AES_ZIPS,
    sourceUrl: "https://www.aes-ohio.com/moving",
    note: "AES Ohio serves Dayton and west-central Ohio electric customers; ZIP prefixes are prefilters and service should be confirmed by address.",
  },
  {
    slug: "cleveland-public-power",
    zipCodes: ["441"],
    sourceUrl: "https://www.cpp.org/Residential/Start-Service",
    note: "Cleveland Public Power is city-scoped and should be confirmed by service address.",
  },
  {
    slug: "columbia-gas-oh",
    zipCodes: OH_COLUMBIA_GAS_ZIPS,
    sourceUrl: "https://www.columbiagasohio.com/services/start-stop-or-move-service",
    note: "Columbia Gas of Ohio provides natural gas service across broad Ohio pockets; service should be confirmed by address.",
  },
  {
    slug: "enbridge-gas-oh",
    zipCodes: OH_ENBRIDGE_GAS_ZIPS,
    sourceUrl: "https://www.enbridgegas.com/ohio/start-stop-service",
    note: "Enbridge Gas Ohio is the current customer surface for former Dominion Energy Ohio gas service; northeast Ohio ZIP prefixes are prefilters.",
  },
  {
    slug: "centerpoint-oh-gas",
    zipCodes: OH_CENTERPOINT_GAS_ZIPS,
    sourceUrl: "https://www.centerpointenergy.com/en-us/residential/customer-service/start-stop-transfer-service?sa=OH",
    note: "CenterPoint Energy Ohio gas service is concentrated in west-central Ohio; CenterPoint says Ohio customer service remains unchanged during the pending National Fuel sale process, and service should be confirmed by address.",
  },
  {
    slug: "cleveland-water",
    zipCodes: OH_CLEVELAND_REGION_ZIPS,
    sourceUrl: "https://www.clevelandwater.com/customer-service/faqs",
    note: "Cleveland Water serves Cleveland and surrounding northeast Ohio communities; ZIP prefixes are prefilters and account setup should be confirmed by address.",
  },
  {
    slug: "toledo-public-utilities",
    zipCodes: OH_TOLEDO_REGION_ZIPS,
    sourceUrl: "https://toledo.oh.gov/residents/water/customer-service/turn-on-new-water-service",
    note: "Toledo Public Utilities is modeled with northwest Ohio ZIP prefixes as prefilters; water account eligibility should be confirmed by address.",
  },
  {
    slug: "neorsd",
    zipCodes: OH_CLEVELAND_REGION_ZIPS,
    sourceUrl: "https://www.neorsd.org/about/service-area-and-facilities/",
    note: "NEORSD serves Greater Cleveland sewer and stormwater customers across multiple communities; ZIP prefixes are regional prefilters.",
  },
  {
    slug: "msd-greater-cincinnati",
    zipCodes: OH_CINCINNATI_REGION_ZIPS,
    sourceUrl: "https://msdgc.org/about-msd/who-we-are/",
    note: "MSD Greater Cincinnati serves Cincinnati/Hamilton County sewer customers with some adjacent communities; ZIP prefixes are regional prefilters.",
  },
  {
    slug: "rumpke-oh",
    zipCodes: OH_RUMPKE_ZIPS,
    sourceUrl: "https://www.rumpke.com/about-us/service-areas/oh",
    note: "Rumpke service varies by municipal contract and address; ZIP prefixes model major Ohio residential service markets only as prefilters.",
  },
  {
    slug: "columbus-refuse",
    zipCodes: OH_COLUMBUS_REGION_ZIPS,
    sourceUrl: "https://www.columbus.gov/Services/Trash-Recycling-Bulk-Collection",
    note: "Columbus refuse collection is city-scoped; central Ohio ZIP prefixes are prefilters and city address should be confirmed.",
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
