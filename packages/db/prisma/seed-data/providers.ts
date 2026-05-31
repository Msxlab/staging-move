// ============================================================
// CONSOLIDATED PROVIDER DATA — Single Source of Truth
// All providers from seed-providers.ts, seed-providers-government.ts,
// seed-providers-all-states.ts, seed-providers-expanded.ts,
// seed-providers-phase2.ts merged + ~200 new providers added.
// Duplicates resolved by keeping the most complete entry.
// ============================================================

const HAWAII_OAHU_ZIPS = [
  "96701", "96706", "96707", "96709", "96712", "96717", "96730", "96731", "96734", "96744", "96759", "96762", "96782", "96786", "96789", "96791", "96792", "96795", "96797",
  "96801", "96802", "96803", "96804", "96805", "96806", "96807", "96808", "96809", "96810", "96811", "96812", "96813", "96814", "96815", "96816", "96817", "96818", "96819", "96820", "96821", "96822", "96823", "96824", "96825", "96826", "96828", "96830", "96836", "96837", "96838", "96839", "96840", "96841", "96843", "96844", "96846", "96847", "96848", "96849", "96850", "96853", "96854", "96857", "96858", "96859", "96860", "96861", "96863",
];

const MA_BOSTON_ZIPS = [
  "02108", "02109", "02110", "02111", "02113", "02114", "02115", "02116", "02118", "02119", "02120", "02121", "02122", "02124", "02125", "02126", "02127", "02128", "02129", "02130", "02131", "02132", "02134", "02135", "02136", "02163", "02199", "02201", "02203", "02205", "02210", "02215", "02222",
];

const NH_LIBERTY_ELECTRIC_ZIPS = [
  "03038", "03076", "03079", "03087", "03240", "03431", "03456", "03601", "03602", "03603", "03608", "03740", "03741", "03745", "03748", "03755", "03766", "03768", "03771", "03781", "03784",
];

const NH_UNITIL_GAS_ZIPS = [
  "03042", "03079", "03801", "03811", "03820", "03823", "03824", "03827", "03833", "03839", "03840", "03842", "03844", "03848", "03862", "03865", "03867", "03869", "03874", "03878", "03885",
];

const NH_PENNICHUCK_ZIPS = [
  "03031", "03036", "03038", "03042", "03049", "03052", "03053", "03054", "03055", "03060", "03062", "03063", "03064", "03076", "03077", "03079", "03087", "03106", "03110", "03225", "03263", "03276", "03281", "03304", "03811", "03833", "03857", "03860", "03861", "03865", "03873", "03887",
];

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

const FL_TAMPA_CITY_ZIPS = ["33602", "33603", "33604", "33605", "33606", "33607", "33609", "33610", "33611", "33612", "33614", "33615", "33616", "33617", "33618", "33619", "33620", "33621", "33629", "33634", "33635", "33637"];

const AR_STATE_ZIPS = ["716", "717", "718", "719", "720", "721", "722", "723", "724", "725", "726", "727", "728", "729"];

const AR_OGE_ZIPS = ["729"];

const AR_SUMMIT_GAS_ZIPS = AR_STATE_ZIPS;

const AR_BLACK_HILLS_GAS_ZIPS = ["720", "721", "724", "725", "726", "727", "728", "729"];

const AR_CARROLL_ELECTRIC_ZIPS = ["726", "727", "728"];

const AR_FIRST_ELECTRIC_ZIPS = ["720", "721", "722", "723"];

const AR_CENTRAL_WATER_ZIPS = ["720", "721", "722"];

const OR_PORTLAND_METRO_ZIPS = ["970", "971", "972"];

const OR_PGE_ZIPS = ["970", "971", "972", "973"];

const PNW_NW_NATURAL_ZIPS = ["970", "971", "972", "973", "974", "986"];

const PNW_CASCADE_GAS_ZIPS = ["970", "971", "973", "977", "978", "982", "983", "985", "986", "988", "989", "993"];

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

const VA_FAIRFAX_WATER_ZIPS = [
  "20120", "20121", "20124", "20151", "20152", "20153",
  "22003", "22015", "22027", "22030", "22031", "22032", "22033", "22034", "22035", "22039", "22041", "22042", "22043", "22044", "22046", "22060", "22066", "22079",
  "22101", "22102", "22124", "22150", "22151", "22152", "22153", "22180", "22181", "22182", "22183", "22185", "22199",
  "22303", "22306", "22307", "22308", "22309", "22310", "22312", "22315",
];

const VA_AMERICAN_WATER_ZIPS = [
  "22026", "22172", "22191", "22192", "22193",
  "22301", "22302", "22303", "22304", "22305", "22306", "22307", "22308", "22309", "22310", "22311", "22312", "22314", "22315",
  "23860",
];

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

export const FEDERAL_NEW = [
  // ══════════════════════════════════════════════════════════
  // GOVERNMENT SERVICES
  // ══════════════════════════════════════════════════════════
  { name: "USPS", slug: "usps", category: "GOVERNMENT_POSTAL", description: "Mail forwarding, address change, PO boxes", website: "https://www.usps.com", phone: "1-800-275-8777", scope: "FEDERAL", popularityScore: 99, tags: ["mail", "government", "essential"] },
  { name: "USPS Movers Guide", slug: "usps-address-change", category: "GOVERNMENT_POSTAL", description: "Official USPS mail forwarding and address change", website: "https://moversguide.usps.com", phone: "1-800-275-8777", scope: "FEDERAL", popularityScore: 98, tags: ["mail", "postal", "address-change"] },
  { name: "UPS", slug: "ups", category: "GOVERNMENT_POSTAL", description: "Package delivery and shipping", website: "https://www.ups.com", phone: "1-800-742-5877", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },
  { name: "FedEx", slug: "fedex", category: "GOVERNMENT_POSTAL", description: "Express shipping and delivery", website: "https://www.fedex.com", phone: "1-800-463-3339", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },
  { name: "IRS", slug: "irs", category: "GOVERNMENT_TAX", description: "Federal tax administration — address change, tax returns, refunds", website: "https://www.irs.gov", phone: "1-800-829-1040", scope: "FEDERAL", popularityScore: 98, tags: ["tax", "government", "essential"] },
  { name: "IRS Form 8822", slug: "irs-address", category: "GOVERNMENT_TAX", description: "Update your address with the IRS (Form 8822)", website: "https://www.irs.gov/faqs/irs-procedures/address-changes", phone: "1-800-829-1040", scope: "FEDERAL", popularityScore: 95, tags: ["tax", "irs"] },
  { name: "USCIS (Immigration)", slug: "uscis", category: "GOVERNMENT_IMMIGRATION", description: "Immigration services — green card, citizenship, visa, AR-11 address change", website: "https://www.uscis.gov", phone: "1-800-375-5283", scope: "FEDERAL", popularityScore: 92, tags: ["immigration", "government", "essential"] },
  { name: "SSA (Social Security)", slug: "ssa", category: "GOVERNMENT_BENEFITS", description: "Social Security cards, benefits, retirement, address update", website: "https://www.ssa.gov", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 95, tags: ["social-security", "government", "essential", "senior"] },
  { name: "VA (Veterans Affairs)", slug: "va-gov", category: "GOVERNMENT_BENEFITS", description: "Veteran benefits, healthcare, disability", website: "https://www.va.gov", phone: "1-800-827-1000", scope: "FEDERAL", popularityScore: 88, tags: ["veterans", "government", "military"] },
  { name: "Healthcare.gov", slug: "healthcare-gov", category: "GOVERNMENT_HEALTH", description: "Health Insurance Marketplace (ACA/Obamacare)", website: "https://www.healthcare.gov", phone: "1-800-318-2596", scope: "FEDERAL", popularityScore: 90, tags: ["health", "government", "essential"] },
  { name: "Medicare.gov", slug: "medicare-gov", category: "GOVERNMENT_HEALTH", description: "Federal health insurance for 65+ and disabled", website: "https://www.medicare.gov", phone: "1-800-633-4227", scope: "FEDERAL", popularityScore: 92, tags: ["health", "government", "senior", "essential"] },
  { name: "Medicaid.gov", slug: "medicaid-gov", category: "GOVERNMENT_HEALTH", description: "Health coverage for low-income individuals", website: "https://www.medicaid.gov", phone: "1-877-267-2323", scope: "FEDERAL", popularityScore: 88, tags: ["health", "government", "essential"] },
  { name: "Federal Student Aid (FAFSA)", slug: "fafsa", category: "GOVERNMENT_EDUCATION", description: "Federal student loans and financial aid", website: "https://studentaid.gov", phone: "1-800-433-3243", scope: "FEDERAL", popularityScore: 85, tags: ["education", "government", "loan"] },
  { name: "StudentAid.gov", slug: "studentaid-gov", category: "GOVERNMENT_EDUCATION", description: "Update address for federal student loans", website: "https://studentaid.gov", phone: "1-800-433-3243", scope: "FEDERAL", popularityScore: 72, tags: ["education", "loans", "student"] },
  { name: "Vote.gov", slug: "vote-gov", category: "GOVERNMENT_VOTER", description: "Voter registration and election info", website: "https://www.vote.gov", scope: "FEDERAL", popularityScore: 82, tags: ["voter", "government", "essential"] },
  { name: "Selective Service System", slug: "selective-service", category: "GOVERNMENT_OTHER", description: "Military draft registration (required for males 18-25)", website: "https://www.sss.gov", phone: "1-888-655-1825", scope: "FEDERAL", popularityScore: 60, tags: ["military", "government"] },
  { name: "US Passport Services", slug: "us-passport", category: "GOVERNMENT_ID", description: "Passport applications, renewals, name changes", website: "https://travel.state.gov/passport", phone: "1-877-487-2778", scope: "FEDERAL", popularityScore: 90, tags: ["passport", "government", "essential", "id"] },
  { name: "TSA PreCheck", slug: "tsa-precheck", category: "GOVERNMENT_OTHER", description: "TSA PreCheck, Global Entry, airport security", website: "https://www.tsa.gov/precheck", phone: "1-866-289-9673", scope: "FEDERAL", popularityScore: 75, tags: ["travel", "government"] },
  { name: "CBP (Customs & Border)", slug: "cbp", category: "GOVERNMENT_OTHER", description: "Global Entry, NEXUS, customs declarations", website: "https://www.cbp.gov", phone: "1-877-227-5511", scope: "FEDERAL", popularityScore: 72, tags: ["travel", "government", "immigration"] },
  { name: "FEMA", slug: "fema", category: "GOVERNMENT_EMERGENCY", description: "Federal Emergency Management Agency", website: "https://www.fema.gov", phone: "1-800-621-3362", scope: "FEDERAL", popularityScore: 78, tags: ["emergency", "government"] },
  { name: "FTC (Federal Trade Commission)", slug: "ftc", category: "GOVERNMENT_OTHER", description: "Consumer protection, identity theft reporting", website: "https://www.ftc.gov", phone: "1-877-382-4357", scope: "FEDERAL", popularityScore: 68, tags: ["consumer", "government"] },
  { name: "SBA (Small Business Admin)", slug: "sba", category: "GOVERNMENT_OTHER", description: "Small business loans, grants, resources", website: "https://www.sba.gov", phone: "1-800-827-5722", scope: "FEDERAL", popularityScore: 72, tags: ["business", "government", "loan"] },
  { name: "HUD (Housing & Urban Dev)", slug: "hud", category: "GOVERNMENT_HOUSING", description: "Fair housing, FHA loans, rental assistance", website: "https://www.hud.gov", phone: "1-800-569-4287", scope: "FEDERAL", popularityScore: 75, tags: ["housing", "government"] },
  { name: "Department of Labor", slug: "dol", category: "GOVERNMENT_OTHER", description: "Employment laws, unemployment insurance, worker rights", website: "https://www.dol.gov", phone: "1-866-487-2365", scope: "FEDERAL", popularityScore: 72, tags: ["employment", "government"] },
  { name: "SSA Disability (SSDI)", slug: "ssa-disability", category: "GOVERNMENT_BENEFITS", description: "Social Security Disability Insurance", website: "https://www.ssa.gov/disability", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 88, tags: ["disability", "government", "essential"] },

  // ══════════════════════════════════════════════════════════
  // BANKS
  // ══════════════════════════════════════════════════════════
  { name: "Chase", slug: "chase", category: "FINANCIAL_BANK", description: "JPMorgan Chase - largest bank in the US", website: "https://www.chase.com", phone: "1-800-935-9935", scope: "FEDERAL", popularityScore: 98, tags: ["banking", "credit-card"] },
  { name: "Bank of America", slug: "bank-of-america", category: "FINANCIAL_BANK", description: "One of the largest banks in the US", website: "https://www.bankofamerica.com", phone: "1-800-432-1000", scope: "FEDERAL", popularityScore: 95, tags: ["banking", "credit-card"] },
  { name: "Wells Fargo", slug: "wells-fargo", category: "FINANCIAL_BANK", description: "Diversified financial services company", website: "https://www.wellsfargo.com", phone: "1-800-869-3557", scope: "FEDERAL", popularityScore: 90, tags: ["banking", "credit-card"] },
  { name: "Citibank", slug: "citibank", category: "FINANCIAL_BANK", description: "Global banking and financial services", website: "https://www.citi.com", phone: "1-800-374-9700", scope: "FEDERAL", popularityScore: 85, tags: ["banking", "credit-card"] },
  { name: "Capital One", slug: "capital-one", category: "FINANCIAL_BANK", description: "Banking and credit card company", website: "https://www.capitalone.com", phone: "1-877-383-4802", scope: "FEDERAL", popularityScore: 82, tags: ["banking", "credit-card"] },
  { name: "US Bank", slug: "us-bank", category: "FINANCIAL_BANK", description: "Fifth-largest bank in the US", website: "https://www.usbank.com", phone: "1-800-872-2657", scope: "FEDERAL", popularityScore: 78, tags: ["banking"] },
  { name: "PNC Bank", slug: "pnc-bank", category: "FINANCIAL_BANK", description: "Regional bank with nationwide presence", website: "https://www.pnc.com", phone: "1-888-762-2265", scope: "FEDERAL", popularityScore: 70, tags: ["banking"] },
  { name: "TD Bank", slug: "td-bank", category: "FINANCIAL_BANK", description: "America's most convenient bank", website: "https://www.td.com", phone: "1-888-751-9000", scope: "FEDERAL", popularityScore: 68, tags: ["banking"] },
  { name: "Ally Bank", slug: "ally-bank", category: "FINANCIAL_BANK", subCategory: "ONLINE", description: "Online-only bank with competitive rates", website: "https://www.ally.com", phone: "1-877-247-2559", scope: "FEDERAL", popularityScore: 72, tags: ["banking", "online"] },
  { name: "Discover Bank", slug: "discover-bank", category: "FINANCIAL_BANK", description: "Online banking and credit cards", website: "https://www.discover.com", phone: "1-800-347-2683", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "credit-card"] },
  { name: "Navy Federal Credit Union", slug: "navy-federal", category: "FINANCIAL_BANK", description: "Largest credit union in the US (military)", website: "https://www.navyfederal.org", phone: "1-888-842-6328", scope: "FEDERAL", popularityScore: 80, tags: ["banking", "credit-union", "military"] },
  { name: "PenFed Credit Union", slug: "penfed", category: "FINANCIAL_BANK", description: "Pentagon Federal Credit Union", website: "https://www.penfed.org", phone: "1-800-247-5626", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "credit-union", "military"] },
  { name: "Alliant Credit Union", slug: "alliant-cu", category: "FINANCIAL_BANK", description: "Large online credit union", website: "https://www.alliantcreditunion.org", phone: "1-800-328-1935", scope: "FEDERAL", popularityScore: 60, tags: ["banking", "credit-union"] },
  { name: "Truist", slug: "truist", category: "FINANCIAL_BANK", description: "Retail and commercial bank with strong Southeast footprint", website: "https://www.truist.com", phone: "1-844-487-8478", scope: "FEDERAL", popularityScore: 78, tags: ["banking"] },
  { name: "Regions Bank", slug: "regions-bank", category: "FINANCIAL_BANK", description: "Regional bank with branch, mobile, and online banking", website: "https://www.regions.com", scope: "FEDERAL", popularityScore: 72, tags: ["banking"] },
  { name: "Huntington Bank", slug: "huntington-bank", category: "FINANCIAL_BANK", description: "Midwest-focused bank with strong digital banking", website: "https://www.huntington.com", scope: "FEDERAL", popularityScore: 70, tags: ["banking"] },
  { name: "Citizens Bank", slug: "citizens-bank", category: "FINANCIAL_BANK", description: "Consumer and business banking across the Northeast and beyond", website: "https://www.citizensbank.com", scope: "FEDERAL", popularityScore: 68, tags: ["banking"] },
  { name: "KeyBank", slug: "keybank", category: "FINANCIAL_BANK", description: "Regional bank with checking, lending, and online banking", website: "https://www.key.com", scope: "FEDERAL", popularityScore: 66, tags: ["banking"] },

  // ══════════════════════════════════════════════════════════
  // CREDIT CARDS
  // ══════════════════════════════════════════════════════════
  { name: "American Express", slug: "amex", category: "FINANCIAL_CREDIT_CARD", description: "Premium credit cards and financial services", website: "https://www.americanexpress.com", phone: "1-800-528-4800", scope: "FEDERAL", popularityScore: 88, tags: ["credit-card"] },
  { name: "Chase Credit Cards", slug: "chase-cards", category: "FINANCIAL_CREDIT_CARD", description: "Sapphire, Freedom, and more", website: "https://creditcards.chase.com", phone: "1-800-432-3117", scope: "FEDERAL", popularityScore: 90, tags: ["credit-card", "banking"] },
  { name: "Citi Cards", slug: "citi-cards", category: "FINANCIAL_CREDIT_CARD", description: "Citibank credit card services", website: "https://www.citi.com/credit-cards", phone: "1-800-950-5114", scope: "FEDERAL", popularityScore: 82, tags: ["credit-card", "banking"] },
  { name: "Synchrony Financial", slug: "synchrony", category: "FINANCIAL_CREDIT_CARD", description: "Store credit cards and financing", website: "https://www.synchrony.com", phone: "1-866-419-4096", scope: "FEDERAL", popularityScore: 72, tags: ["credit-card"] },
  { name: "Barclays US", slug: "barclays-us", category: "FINANCIAL_CREDIT_CARD", description: "Credit cards and personal banking", website: "https://www.barclaysus.com", phone: "1-877-523-0478", scope: "FEDERAL", popularityScore: 68, tags: ["credit-card"] },
  { name: "Discover Card", slug: "discover-card", category: "FINANCIAL_CREDIT_CARD", description: "Cash back and travel credit cards by Discover", website: "https://www.discover.com/credit-cards", phone: "1-800-347-2683", scope: "FEDERAL", popularityScore: 80, tags: ["credit-card", "banking"] },
  { name: "Capital One Credit Cards", slug: "capital-one-cards", category: "FINANCIAL_CREDIT_CARD", description: "Venture, Savor, Quicksilver, and more", website: "https://www.capitalone.com/credit-cards", scope: "FEDERAL", popularityScore: 86, tags: ["credit-card", "banking"] },
  { name: "Bank of America Credit Cards", slug: "boa-cards", category: "FINANCIAL_CREDIT_CARD", description: "Travel Rewards, Customized Cash, and more", website: "https://www.bankofamerica.com/credit-cards", scope: "FEDERAL", popularityScore: 84, tags: ["credit-card", "banking"] },
  { name: "Wells Fargo Credit Cards", slug: "wells-fargo-cards", category: "FINANCIAL_CREDIT_CARD", description: "Active Cash, Autograph, and more", website: "https://creditcards.wellsfargo.com", scope: "FEDERAL", popularityScore: 78, tags: ["credit-card", "banking"] },
  { name: "U.S. Bank Credit Cards", slug: "us-bank-cards", category: "FINANCIAL_CREDIT_CARD", description: "Cash+, Altitude, and co-branded cards", website: "https://www.usbank.com/credit-cards.html", scope: "FEDERAL", popularityScore: 74, tags: ["credit-card", "banking"] },
  { name: "Credit One Bank", slug: "credit-one-bank", category: "FINANCIAL_CREDIT_CARD", description: "Consumer credit card issuer for online billing and account address management", website: "https://www.creditonebank.com", phone: "1-877-825-3242", scope: "FEDERAL", popularityScore: 66, tags: ["credit-card", "billing"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — AUTO
  // ══════════════════════════════════════════════════════════
  { name: "GEICO", slug: "geico", category: "FINANCIAL_INSURANCE_AUTO", description: "Government Employees Insurance Company", website: "https://www.geico.com", phone: "1-800-207-7847", scope: "FEDERAL", popularityScore: 92, tags: ["auto", "car"] },
  { name: "State Farm", slug: "state-farm", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.statefarm.com", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 90, tags: ["auto", "home", "car"] },
  { name: "Progressive", slug: "progressive", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto insurance and more", website: "https://www.progressive.com", phone: "1-800-776-4737", scope: "FEDERAL", popularityScore: 88, tags: ["auto", "car"] },
  { name: "Allstate", slug: "allstate", category: "FINANCIAL_INSURANCE_AUTO", description: "You're in good hands", website: "https://www.allstate.com", phone: "1-800-255-7828", scope: "FEDERAL", popularityScore: 85, tags: ["auto", "home", "car"] },
  { name: "Liberty Mutual", slug: "liberty-mutual", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto, home, and life insurance", website: "https://www.libertymutual.com", phone: "1-800-290-8206", scope: "FEDERAL", popularityScore: 78, tags: ["auto", "home", "car"] },
  { name: "USAA", slug: "usaa", category: "FINANCIAL_INSURANCE_AUTO", description: "For military members and families", website: "https://www.usaa.com", phone: "1-800-531-8722", scope: "FEDERAL", popularityScore: 82, tags: ["auto", "home", "military"] },
  { name: "Nationwide", slug: "nationwide", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.nationwide.com", phone: "1-877-669-6877", scope: "FEDERAL", popularityScore: 75, tags: ["auto", "home", "car"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — HOME
  // ══════════════════════════════════════════════════════════
  { name: "Lemonade Insurance", slug: "lemonade", category: "FINANCIAL_INSURANCE_HOME", description: "AI-powered renters and homeowners insurance", website: "https://www.lemonade.com", phone: "1-844-733-8666", scope: "FEDERAL", popularityScore: 70, tags: ["home", "renters"] },
  { name: "State Farm Home", slug: "state-farm-home", category: "FINANCIAL_INSURANCE_HOME", description: "Homeowners and renters insurance", website: "https://www.statefarm.com/insurance/home-and-property", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 88, tags: ["home", "renters"] },
  { name: "Travelers Insurance", slug: "travelers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, and business insurance", website: "https://www.travelers.com", phone: "1-800-842-5075", scope: "FEDERAL", popularityScore: 82, tags: ["home", "auto"] },
  { name: "Farmers Insurance", slug: "farmers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, life, and business", website: "https://www.farmers.com", phone: "1-888-327-6335", scope: "FEDERAL", popularityScore: 78, tags: ["home", "auto", "car"] },
  { name: "American Home Shield", slug: "ahs", category: "FINANCIAL_INSURANCE_HOME", description: "Home warranty and protection plans", website: "https://www.ahs.com", phone: "1-800-776-4663", scope: "FEDERAL", popularityScore: 75, tags: ["home", "warranty"] },
  { name: "Choice Home Warranty", slug: "choice-warranty", category: "FINANCIAL_INSURANCE_HOME", description: "Home warranty plans", website: "https://www.choicehomewarranty.com", phone: "1-888-531-5403", scope: "FEDERAL", popularityScore: 68, tags: ["home", "warranty"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — HEALTH
  // ══════════════════════════════════════════════════════════
  { name: "UnitedHealthcare", slug: "unitedhealthcare", category: "FINANCIAL_INSURANCE_HEALTH", description: "Largest health insurance company in the US", website: "https://www.uhc.com", phone: "1-800-328-5979", scope: "FEDERAL", popularityScore: 88, tags: ["health"] },
  { name: "Blue Cross Blue Shield", slug: "bcbs", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance federation", website: "https://www.bcbs.com", phone: "1-888-630-2583", scope: "FEDERAL", popularityScore: 90, tags: ["health"] },
  { name: "Aetna", slug: "aetna", category: "FINANCIAL_INSURANCE_HEALTH", description: "CVS Health company - individual plans available in select states", website: "https://www.aetna.com", phone: "1-800-872-3862", scope: "STATE", states: ["CA", "TX", "FL", "NY", "PA", "OH", "IL", "NC", "GA", "MI", "AZ", "VA", "WA", "MA", "NJ", "MO", "IN", "TN", "CO", "MD"], popularityScore: 82, tags: ["health"] },
  { name: "Cigna", slug: "cigna", category: "FINANCIAL_INSURANCE_HEALTH", description: "Global health service company", website: "https://www.cigna.com", phone: "1-800-997-1654", scope: "FEDERAL", popularityScore: 80, tags: ["health"] },
  { name: "Kaiser Permanente", slug: "kaiser", category: "FINANCIAL_INSURANCE_HEALTH", description: "Integrated managed care in 8 states", website: "https://www.kp.org", phone: "1-800-464-4000", scope: "STATE", states: ["CA", "CO", "GA", "HI", "MD", "OR", "VA", "WA"], popularityScore: 75, tags: ["health"] },
  { name: "Humana", slug: "humana", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance and wellness", website: "https://www.humana.com", phone: "1-800-457-4708", scope: "FEDERAL", popularityScore: 72, tags: ["health", "senior", "medicare"] },
  { name: "Oscar Health", slug: "oscar-health", category: "FINANCIAL_INSURANCE_HEALTH", description: "Technology-focused health insurance in 7 states", website: "https://www.hioscar.com", phone: "1-855-672-2788", scope: "STATE", states: ["CA", "TX", "FL", "NY", "NJ", "OH", "MI"], popularityScore: 68, tags: ["health"] },
  { name: "Ambetter (Centene)", slug: "ambetter", category: "FINANCIAL_INSURANCE_HEALTH", description: "ACA marketplace health plans in 29 states", website: "https://www.ambetterhealth.com", scope: "FEDERAL", popularityScore: 65, tags: ["health", "marketplace"] },
  { name: "Molina Healthcare", slug: "molina", category: "FINANCIAL_INSURANCE_HEALTH", description: "Medicaid and marketplace plans in 19 states", website: "https://www.molinahealthcare.com", phone: "1-888-562-5442", scope: "STATE", states: ["CA", "FL", "TX", "NY", "OH", "MI", "WA", "OR", "UT", "AZ", "NM", "WI", "IL", "IN", "SC", "KY", "TN", "AR", "MS"], popularityScore: 62, tags: ["health", "medicaid"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — DENTAL / VISION
  // ══════════════════════════════════════════════════════════
  { name: "Delta Dental", slug: "delta-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Largest dental insurance provider in the US", website: "https://www.deltadental.com", phone: "1-800-932-0783", scope: "FEDERAL", popularityScore: 85, tags: ["dental", "health"] },
  { name: "VSP Vision Care", slug: "vsp", category: "FINANCIAL_INSURANCE_HEALTH", description: "Vision insurance and eye care", website: "https://www.vsp.com", phone: "1-800-877-7195", scope: "FEDERAL", popularityScore: 78, tags: ["vision", "health"] },
  { name: "MetLife Dental", slug: "metlife-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Dental insurance plans", website: "https://www.metlife.com/dental-insurance", phone: "1-800-942-0854", scope: "FEDERAL", popularityScore: 72, tags: ["dental", "health"] },
  { name: "Guardian Dental", slug: "guardian-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Dental and vision insurance", website: "https://www.guardianlife.com", phone: "1-800-541-7846", scope: "FEDERAL", popularityScore: 68, tags: ["dental", "vision", "health"] },
  { name: "EyeMed Vision Care", slug: "eyemed", category: "FINANCIAL_INSURANCE_HEALTH", description: "Vision insurance for individuals and families", website: "https://www.eyemed.com", phone: "1-866-939-3633", scope: "FEDERAL", popularityScore: 65, tags: ["vision", "health"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — LIFE
  // ══════════════════════════════════════════════════════════
  { name: "New York Life", slug: "ny-life", category: "FINANCIAL_INSURANCE_LIFE", description: "Largest mutual life insurance company", website: "https://www.newyorklife.com", phone: "1-800-710-7945", scope: "FEDERAL", popularityScore: 82, tags: ["life", "insurance"] },
  { name: "Northwestern Mutual", slug: "northwestern-mutual", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and financial planning", website: "https://www.northwesternmutual.com", phone: "1-866-950-4644", scope: "FEDERAL", popularityScore: 78, tags: ["life", "insurance"] },
  { name: "Prudential", slug: "prudential", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and financial planning", website: "https://www.prudential.com", phone: "1-800-778-2255", scope: "FEDERAL", popularityScore: 82, tags: ["insurance", "senior"] },
  { name: "MassMutual", slug: "massmutual", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and retirement services", website: "https://www.massmutual.com", phone: "1-800-272-2216", scope: "FEDERAL", popularityScore: 72, tags: ["life", "insurance"] },
  { name: "Lincoln Financial", slug: "lincoln-financial", category: "FINANCIAL_INSURANCE_LIFE", description: "Life, annuities, and retirement plans", website: "https://www.lincolnfinancial.com", phone: "1-877-275-5462", scope: "FEDERAL", popularityScore: 68, tags: ["life", "insurance"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — PET / MOTORCYCLE / BOAT / FLOOD
  // ══════════════════════════════════════════════════════════
  { name: "Trupanion", slug: "trupanion", category: "FINANCIAL_INSURANCE_PET", description: "Medical insurance for cats and dogs", website: "https://www.trupanion.com", phone: "1-855-591-3100", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Healthy Paws", slug: "healthy-paws", category: "FINANCIAL_INSURANCE_PET", description: "Pet health insurance", website: "https://www.healthypawspetinsurance.com", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Nationwide Pet Insurance", slug: "nationwide-pet", category: "FINANCIAL_INSURANCE_PET", description: "Pet insurance by Nationwide", website: "https://www.petinsurance.com", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Progressive Motorcycle", slug: "progressive-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "#1 motorcycle insurance in the US", website: "https://www.progressive.com/motorcycle", scope: "FEDERAL", popularityScore: 88, tags: ["motorcycle", "insurance"] },
  { name: "GEICO Motorcycle", slug: "geico-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "Motorcycle insurance by GEICO", website: "https://www.geico.com/motorcycle-insurance", scope: "FEDERAL", popularityScore: 85, tags: ["motorcycle", "insurance"] },
  { name: "Progressive Boat Insurance", slug: "progressive-boat", category: "FINANCIAL_INSURANCE_BOAT", description: "#1 boat insurance in the US", website: "https://www.progressive.com/boat", scope: "FEDERAL", popularityScore: 82, tags: ["boat", "insurance"] },
  { name: "NFIP (Flood Insurance)", slug: "nfip-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "National Flood Insurance Program", website: "https://www.floodsmart.gov", scope: "FEDERAL", popularityScore: 70, tags: ["home", "insurance"] },

  // ══════════════════════════════════════════════════════════
  // MORTGAGE & LOANS
  // ══════════════════════════════════════════════════════════
  { name: "Rocket Mortgage", slug: "rocket-mortgage", category: "FINANCIAL_MORTGAGE", description: "Online mortgage lender", website: "https://www.rocketmortgage.com", phone: "1-800-785-4632", scope: "FEDERAL", popularityScore: 82, tags: ["mortgage", "home"] },
  { name: "Better.com", slug: "better", category: "FINANCIAL_MORTGAGE", description: "Digital mortgage lender", website: "https://www.better.com", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home"] },
  { name: "SoFi", slug: "sofi", category: "FINANCIAL_FINTECH", description: "All-in-one banking, loans, and investing", website: "https://www.sofi.com", phone: "1-855-456-7634", scope: "FEDERAL", popularityScore: 82, tags: ["loan", "banking", "fintech"] },
  { name: "LendingClub", slug: "lendingclub", category: "FINANCIAL_LOAN", description: "Personal loans and banking", website: "https://www.lendingclub.com", phone: "1-888-596-3157", scope: "FEDERAL", popularityScore: 72, tags: ["loan"] },

  // ══════════════════════════════════════════════════════════
  // PHONE CARRIERS
  // ══════════════════════════════════════════════════════════
  { name: "AT&T", slug: "att", category: "UTILITY_PHONE", description: "Wireless, internet, and TV services", website: "https://www.att.com", phone: "1-800-331-0500", scope: "FEDERAL", popularityScore: 92, tags: ["phone", "internet", "tv"] },
  { name: "Verizon", slug: "verizon", category: "UTILITY_PHONE", description: "Wireless and fiber services", website: "https://www.verizon.com", phone: "1-800-922-0204", scope: "FEDERAL", popularityScore: 90, tags: ["phone", "internet", "fiber"] },
  { name: "T-Mobile", slug: "t-mobile", category: "UTILITY_PHONE", description: "Un-carrier wireless service", website: "https://www.t-mobile.com", phone: "1-800-937-8997", scope: "FEDERAL", popularityScore: 88, tags: ["phone"] },
  { name: "Mint Mobile", slug: "mint-mobile", category: "UTILITY_PHONE", description: "Budget-friendly wireless", website: "https://www.mintmobile.com", scope: "FEDERAL", popularityScore: 65, tags: ["phone", "budget"] },
  { name: "Google Fi", slug: "google-fi", category: "UTILITY_PHONE", description: "Flexible phone plan by Google", website: "https://fi.google.com", scope: "FEDERAL", popularityScore: 55, tags: ["phone"] },
  { name: "Xfinity Mobile", slug: "xfinity-mobile", category: "UTILITY_PHONE", description: "Wireless plans by Comcast Xfinity", website: "https://www.xfinity.com/mobile", scope: "FEDERAL", popularityScore: 76, tags: ["phone", "mvno"] },
  { name: "Spectrum Mobile", slug: "spectrum-mobile", category: "UTILITY_PHONE", description: "Wireless service by Charter Spectrum", website: "https://www.spectrum.com/mobile", scope: "FEDERAL", popularityScore: 70, tags: ["phone", "mvno"] },
  { name: "Visible", slug: "visible", category: "UTILITY_PHONE", description: "Simple wireless plans powered by Verizon", website: "https://www.visible.com", scope: "FEDERAL", popularityScore: 62, tags: ["phone", "budget", "mvno"] },
  { name: "Cricket Wireless", slug: "cricket-wireless", category: "UTILITY_PHONE", description: "Prepaid wireless service by AT&T", website: "https://www.cricketwireless.com", scope: "FEDERAL", popularityScore: 68, tags: ["phone", "prepaid", "budget"] },
  { name: "Metro by T-Mobile", slug: "metro-by-t-mobile", category: "UTILITY_PHONE", description: "Prepaid wireless plans on T-Mobile", website: "https://www.metrobyt-mobile.com", scope: "FEDERAL", popularityScore: 66, tags: ["phone", "prepaid", "budget"] },
  { name: "Boost Mobile", slug: "boost-mobile", category: "UTILITY_PHONE", description: "Prepaid wireless and device deals", website: "https://www.boostmobile.com", scope: "FEDERAL", popularityScore: 60, tags: ["phone", "prepaid", "budget"] },
  { name: "Consumer Cellular", slug: "consumer-cellular", category: "UTILITY_PHONE", description: "Wireless plans popular with seniors", website: "https://www.consumercellular.com", scope: "FEDERAL", popularityScore: 58, tags: ["phone", "senior"] },
  { name: "US Mobile", slug: "us-mobile", category: "UTILITY_PHONE", description: "Customizable wireless plans on major networks", website: "https://www.usmobile.com", scope: "FEDERAL", popularityScore: 56, tags: ["phone", "mvno"] },
  { name: "Straight Talk", slug: "straight-talk", category: "UTILITY_PHONE", description: "Nationwide prepaid wireless plans", website: "https://www.straighttalk.com", scope: "FEDERAL", popularityScore: 54, tags: ["phone", "prepaid", "budget"] },
  { name: "Total Wireless", slug: "total-wireless", category: "UTILITY_PHONE", description: "Value-focused prepaid wireless service", website: "https://www.totalwireless.com", scope: "FEDERAL", popularityScore: 52, tags: ["phone", "prepaid", "budget"] },

  // ══════════════════════════════════════════════════════════
  // INTERNET (Nationwide)
  // ══════════════════════════════════════════════════════════
  { name: "Xfinity (Comcast)", slug: "xfinity", category: "UTILITY_INTERNET", description: "Internet, TV, and streaming", website: "https://www.xfinity.com", phone: "1-800-934-6489", scope: "FEDERAL", popularityScore: 85, tags: ["internet", "tv", "cable"] },
  { name: "Spectrum", slug: "spectrum", category: "UTILITY_INTERNET", description: "Internet, TV, and voice", website: "https://www.spectrum.com", phone: "1-833-267-6094", scope: "FEDERAL", popularityScore: 80, tags: ["internet", "tv", "cable"] },
  { name: "AT&T Fiber", slug: "att-fiber", category: "UTILITY_INTERNET", description: "Fiber internet service", website: "https://www.att.com/internet/fiber", phone: "1-855-220-5211", scope: "FEDERAL", popularityScore: 78, tags: ["internet", "fiber"] },
  { name: "Verizon Fios", slug: "verizon-fios", category: "UTILITY_INTERNET", description: "100% fiber optic internet", website: "https://www.verizon.com/fios", phone: "1-800-837-4966", scope: "FEDERAL", popularityScore: 76, tags: ["internet", "fiber"] },
  // T-Mobile Home Internet is defined once below as slug "tmobile-home-internet"
  // (with a phone + nationwide copy). The duplicate FEDERAL row that used to sit
  // here was removed so it isn't listed twice in every state's internet results.
  { name: "Starlink", slug: "starlink", category: "UTILITY_INTERNET", description: "Satellite internet by SpaceX", website: "https://www.starlink.com", scope: "FEDERAL", popularityScore: 55, tags: ["internet", "satellite", "rural"] },

  // ══════════════════════════════════════════════════════════
  // TV / STREAMING
  // ══════════════════════════════════════════════════════════
  { name: "DirecTV", slug: "directv", category: "UTILITY_CABLE", description: "Satellite TV service", website: "https://www.directv.com", phone: "1-800-531-5000", scope: "FEDERAL", popularityScore: 65, tags: ["tv", "satellite"] },
  { name: "YouTube TV", slug: "youtube-tv", category: "UTILITY_CABLE", description: "Live TV streaming", website: "https://tv.youtube.com", scope: "FEDERAL", popularityScore: 72, tags: ["tv", "streaming"] },

  // ══════════════════════════════════════════════════════════
  // TRASH / WASTE
  // ══════════════════════════════════════════════════════════
  { name: "Waste Management", slug: "waste-management", category: "UTILITY_TRASH", description: "Largest waste services provider in the US", website: "https://www.wm.com", phone: "1-866-797-9018", scope: "FEDERAL", popularityScore: 80, tags: ["trash", "waste", "recycling"] },
  { name: "Republic Services", slug: "republic-services", category: "UTILITY_TRASH", description: "Environmental services", website: "https://www.republicservices.com", phone: "1-800-422-2733", scope: "FEDERAL", popularityScore: 70, tags: ["trash", "waste"] },

  // ══════════════════════════════════════════════════════════
  // FITNESS / GYM
  // ══════════════════════════════════════════════════════════
  { name: "Planet Fitness", slug: "planet-fitness", category: "FITNESS_GYM", description: "Judgement free zone", website: "https://www.planetfitness.com", phone: "1-844-880-7180", scope: "FEDERAL", popularityScore: 90, tags: ["gym", "fitness", "budget"] },
  { name: "LA Fitness", slug: "la-fitness", category: "FITNESS_GYM", description: "Full-service health club", website: "https://www.lafitness.com", phone: "1-949-255-7200", scope: "FEDERAL", popularityScore: 78, tags: ["gym", "fitness"] },
  { name: "Anytime Fitness", slug: "anytime-fitness", category: "FITNESS_GYM", description: "24/7 gym access worldwide", website: "https://www.anytimefitness.com", phone: "1-800-704-5004", scope: "FEDERAL", popularityScore: 75, tags: ["gym", "fitness"] },
  { name: "Equinox", slug: "equinox", category: "FITNESS_GYM", description: "High-performance luxury fitness", website: "https://www.equinox.com", scope: "FEDERAL", popularityScore: 60, tags: ["gym", "fitness", "luxury"] },
  { name: "Orangetheory", slug: "orangetheory", category: "FITNESS_GYM", description: "Heart-rate based interval training", website: "https://www.orangetheory.com", scope: "FEDERAL", popularityScore: 65, tags: ["gym", "fitness", "classes"] },
  { name: "YMCA", slug: "ymca", category: "FITNESS_GYM", description: "Community programs, youth activities, fitness", website: "https://www.ymca.org", scope: "FEDERAL", popularityScore: 88, tags: ["gym", "fitness", "kids", "community"] },
  { name: "Peloton", slug: "peloton", category: "FITNESS_GYM", subCategory: "ONLINE", description: "Connected fitness at home", website: "https://www.onepeloton.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "home", "online"] },

  // FITNESS / STUDIO
  { name: "Pure Barre", slug: "pure-barre", category: "FITNESS_STUDIO", description: "Low-impact barre fitness studios", website: "https://www.purebarre.com", scope: "FEDERAL", popularityScore: 68, tags: ["fitness", "barre"] },
  { name: "Barry's", slug: "barrys", category: "FITNESS_STUDIO", description: "High-intensity interval and strength training studios", website: "https://www.barrys.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "hiit"] },
  { name: "SoulCycle", slug: "soulcycle", category: "FITNESS_STUDIO", description: "Boutique indoor cycling studios", website: "https://www.soul-cycle.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "cycling"] },
  { name: "CorePower Yoga", slug: "corepower-yoga", category: "FITNESS_STUDIO", description: "Heated yoga and sculpt studios", website: "https://www.corepoweryoga.com", scope: "FEDERAL", popularityScore: 70, tags: ["fitness", "yoga"] },
  { name: "F45 Training", slug: "f45", category: "FITNESS_STUDIO", description: "Functional 45-minute group workouts", website: "https://www.f45training.com", scope: "FEDERAL", popularityScore: 60, tags: ["fitness", "hiit"] },
  { name: "Club Pilates", slug: "club-pilates", category: "FITNESS_STUDIO", description: "Reformer Pilates studio franchise", website: "https://www.clubpilates.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "pilates"] },
  { name: "CycleBar", slug: "cyclebar", category: "FITNESS_STUDIO", description: "Premium indoor cycling studios", website: "https://www.cyclebar.com", scope: "FEDERAL", popularityScore: 55, tags: ["fitness", "cycling"] },
  { name: "StretchLab", slug: "stretchlab", category: "FITNESS_STUDIO", description: "Assisted stretching studios", website: "https://www.stretchlab.com", scope: "FEDERAL", popularityScore: 58, tags: ["fitness", "recovery"] },

  // ══════════════════════════════════════════════════════════
  // SUBSCRIPTIONS & STREAMING
  // ══════════════════════════════════════════════════════════
  { name: "Amazon Prime", slug: "amazon-prime", category: "SHOPPING_SUBSCRIPTION", description: "Free shipping, video, music, and more", website: "https://www.amazon.com/prime", scope: "FEDERAL", popularityScore: 98, tags: ["subscription", "shopping", "streaming"] },
  { name: "Netflix", slug: "netflix", category: "SHOPPING_SUBSCRIPTION", description: "Streaming movies and TV shows", website: "https://www.netflix.com", scope: "FEDERAL", popularityScore: 95, tags: ["subscription", "streaming"] },
  { name: "Spotify", slug: "spotify", category: "SHOPPING_SUBSCRIPTION", description: "Music and podcast streaming", website: "https://www.spotify.com", scope: "FEDERAL", popularityScore: 88, tags: ["subscription", "music"] },
  { name: "Apple One", slug: "apple-one", category: "SHOPPING_SUBSCRIPTION", description: "Apple Music, TV+, Arcade, iCloud+", website: "https://www.apple.com/apple-one", scope: "FEDERAL", popularityScore: 75, tags: ["subscription", "streaming"] },
  { name: "Disney+", slug: "disney-plus", category: "SHOPPING_SUBSCRIPTION", description: "Disney, Pixar, Marvel, Star Wars", website: "https://www.disneyplus.com", scope: "FEDERAL", popularityScore: 80, tags: ["subscription", "streaming", "kids"] },
  { name: "Costco", slug: "costco", category: "SHOPPING_SUBSCRIPTION", description: "Wholesale club membership", website: "https://www.costco.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "shopping"] },
  { name: "Sam's Club", slug: "sams-club", category: "SHOPPING_SUBSCRIPTION", description: "Walmart wholesale club", website: "https://www.samsclub.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "shopping"] },
  { name: "HBO Max", slug: "hbo-max", category: "SHOPPING_SUBSCRIPTION", description: "Streaming from HBO, Warner Bros", website: "https://www.max.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "streaming"] },
  { name: "Hulu", slug: "hulu", category: "SHOPPING_SUBSCRIPTION", description: "TV shows, movies, and originals", website: "https://www.hulu.com", scope: "FEDERAL", popularityScore: 88, tags: ["subscription", "streaming"] },
  { name: "Apple TV+", slug: "apple-tv", category: "SHOPPING_SUBSCRIPTION", description: "Apple originals and movies", website: "https://tv.apple.com", scope: "FEDERAL", popularityScore: 75, tags: ["subscription", "streaming"] },
  { name: "Paramount+", slug: "paramount-plus", category: "SHOPPING_SUBSCRIPTION", description: "CBS, Paramount, and originals", website: "https://www.paramountplus.com", scope: "FEDERAL", popularityScore: 72, tags: ["subscription", "streaming"] },
  { name: "Peacock", slug: "peacock", category: "SHOPPING_SUBSCRIPTION", description: "NBCUniversal streaming", website: "https://www.peacocktv.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "streaming"] },
  { name: "Apple Music", slug: "apple-music", category: "SHOPPING_SUBSCRIPTION", description: "Music streaming service", website: "https://music.apple.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "music"] },
  { name: "YouTube Premium", slug: "youtube-premium", category: "SHOPPING_SUBSCRIPTION", description: "Ad-free YouTube and music", website: "https://www.youtube.com/premium", scope: "FEDERAL", popularityScore: 78, tags: ["subscription", "streaming", "music"] },
  { name: "Chewy", slug: "chewy", category: "SHOPPING_SUBSCRIPTION", description: "Pet food and supplies subscription", website: "https://www.chewy.com", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "subscription", "dog", "cat"] },
  { name: "AARP", slug: "aarp", category: "SHOPPING_SUBSCRIPTION", description: "Membership for age 50+", website: "https://www.aarp.org", scope: "FEDERAL", popularityScore: 75, tags: ["senior", "subscription", "medicare"] },
  { name: "Thrive Market", slug: "thrive-market", category: "SHOPPING_SUBSCRIPTION", description: "Membership-based grocery, supplements, and wellness product delivery", website: "https://thrivemarket.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "grocery", "wellness", "supplements"] },

  // ══════════════════════════════════════════════════════════
  // HEALTHCARE — PHARMACY, DOCTOR, DENTIST, VET, SENIOR
  // ══════════════════════════════════════════════════════════
  { name: "CVS Pharmacy", slug: "cvs", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.cvs.com", phone: "1-800-746-7287", scope: "FEDERAL", popularityScore: 88, tags: ["pharmacy", "health"] },
  { name: "Walgreens", slug: "walgreens", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.walgreens.com", phone: "1-800-925-4733", scope: "FEDERAL", popularityScore: 85, tags: ["pharmacy", "health"] },
  { name: "GoodRx", slug: "goodrx", category: "HEALTHCARE_PHARMACY", description: "Prescription drug discounts and coupons", website: "https://www.goodrx.com", scope: "FEDERAL", popularityScore: 85, tags: ["health", "pharmacy"] },
  { name: "Amazon Pharmacy", slug: "amazon-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Online pharmacy with Prime savings", website: "https://pharmacy.amazon.com", scope: "FEDERAL", popularityScore: 68, tags: ["pharmacy", "health", "online"] },
  { name: "Rite Aid", slug: "rite-aid", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and wellness products", website: "https://www.riteaid.com", phone: "1-800-748-3243", scope: "FEDERAL", popularityScore: 80, tags: ["pharmacy", "health"] },
  { name: "Costco Pharmacy", slug: "costco-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Pharmacy services for Costco members", website: "https://www.costco.com/pharmacy", phone: "1-800-607-6861", scope: "FEDERAL", popularityScore: 75, tags: ["pharmacy", "health"] },
  { name: "Costco Optical", slug: "costco-optical", category: "HEALTHCARE_PHARMACY", description: "Eye exams and eyewear", website: "https://www.costco.com/optical", scope: "FEDERAL", popularityScore: 72, tags: ["vision", "health"] },
  { name: "Walmart Pharmacy", slug: "walmart-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Retail pharmacy services and prescription management", website: "https://www.walmart.com/cp/pharmacy/5431", scope: "FEDERAL", popularityScore: 82, tags: ["pharmacy", "health", "retail"] },
  { name: "Kroger Pharmacy", slug: "kroger-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Grocery pharmacy services and prescription management", website: "https://www.kroger.com/health/pharmacy", scope: "FEDERAL", popularityScore: 74, tags: ["pharmacy", "health", "grocery"] },
  { name: "Express Scripts", slug: "express-scripts", category: "HEALTHCARE_PHARMACY", description: "Mail-order pharmacy and pharmacy benefit account management", website: "https://www.express-scripts.com", scope: "FEDERAL", popularityScore: 72, tags: ["pharmacy", "mail-order", "benefits"] },
  { name: "Optum Rx", slug: "optum-rx", category: "HEALTHCARE_PHARMACY", description: "Mail-order pharmacy and prescription benefit account management", website: "https://www.optumrx.com", scope: "FEDERAL", popularityScore: 72, tags: ["pharmacy", "mail-order", "benefits"] },
  { name: "Teladoc Health", slug: "teladoc", category: "HEALTHCARE_TELEMEDICINE", description: "Virtual care for general medical, mental health, and more", website: "https://www.teladoc.com", phone: "1-800-835-2362", scope: "FEDERAL", popularityScore: 85, tags: ["telemedicine", "virtual", "health"] },
  { name: "ZocDoc", slug: "zocdoc", category: "HEALTHCARE_DOCTORS", description: "Find and book doctors online", website: "https://www.zocdoc.com", scope: "FEDERAL", popularityScore: 72, tags: ["health", "doctor"] },
  { name: "One Medical", slug: "one-medical", category: "HEALTHCARE_TELEMEDICINE", description: "Primary care memberships with same-day virtual visits", website: "https://www.onemedical.com", phone: "1-888-663-6331", scope: "FEDERAL", popularityScore: 78, tags: ["telemedicine", "primary-care", "membership"] },
  { name: "MinuteClinic (CVS)", slug: "minuteclinic", category: "HEALTHCARE_DOCTORS", description: "Walk-in clinics inside CVS stores", website: "https://www.cvs.com/minuteclinic", phone: "1-866-389-2727", scope: "FEDERAL", popularityScore: 80, tags: ["health", "doctor"] },
  { name: "Aspen Dental", slug: "aspen-dental", category: "HEALTHCARE_DENTIST", description: "Dental care with 1000+ offices", website: "https://www.aspendental.com", phone: "1-844-789-2572", scope: "FEDERAL", popularityScore: 80, tags: ["health", "dental"] },
  { name: "Banfield Pet Hospital", slug: "banfield", category: "HEALTHCARE_VET", description: "Preventive pet care", website: "https://www.banfield.com", phone: "1-866-894-7927", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "vet", "dog", "cat"] },
  { name: "VCA Animal Hospitals", slug: "vca", category: "HEALTHCARE_VET", description: "Veterinary care network", website: "https://www.vcahospitals.com", scope: "FEDERAL", popularityScore: 65, tags: ["pet", "vet"] },
  { name: "Visiting Angels", slug: "visiting-angels", category: "HEALTHCARE_SENIOR", description: "In-home senior care services", website: "https://www.visitingangels.com", phone: "1-800-365-4189", scope: "FEDERAL", popularityScore: 78, tags: ["senior"] },
  { name: "Home Instead", slug: "home-instead", category: "HEALTHCARE_SENIOR", description: "Personalized in-home senior care", website: "https://www.homeinstead.com", phone: "1-888-484-5759", scope: "FEDERAL", popularityScore: 80, tags: ["senior"] },
  { name: "Meals on Wheels", slug: "meals-on-wheels", category: "HEALTHCARE_SENIOR", description: "Home-delivered meals for seniors", website: "https://www.mealsonwheelsamerica.org", scope: "FEDERAL", popularityScore: 82, tags: ["senior"] },

  // ══════════════════════════════════════════════════════════
  // KIDS — DAYCARE, SCHOOL, ACTIVITIES
  // ══════════════════════════════════════════════════════════
  { name: "Kumon", slug: "kumon", category: "KIDS_ACTIVITY", description: "After-school math and reading program", website: "https://www.kumon.com", phone: "1-800-222-6284", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "education", "children"] },
  { name: "KinderCare", slug: "kindercare", category: "KIDS_DAYCARE", description: "Early childhood education", website: "https://www.kindercare.com", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "daycare", "children"] },
  { name: "Bright Horizons", slug: "bright-horizons", category: "KIDS_DAYCARE", description: "Child care and early education", website: "https://www.brighthorizons.com", scope: "FEDERAL", popularityScore: 62, tags: ["kids", "daycare", "children"] },
  { name: "Care.com", slug: "care-com", category: "KIDS_DAYCARE", description: "Find babysitters, nannies, and daycares", website: "https://www.care.com", scope: "FEDERAL", popularityScore: 85, tags: ["kids", "daycare", "children", "senior"] },
  { name: "The Goddard School", slug: "goddard-school", category: "KIDS_DAYCARE", description: "Play-based preschool and childcare franchise", website: "https://www.goddardschool.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "daycare", "preschool"] },
  { name: "Head Start", slug: "head-start", category: "KIDS_SCHOOL", description: "Federal early childhood education", website: "https://www.acf.hhs.gov/ohs", scope: "FEDERAL", popularityScore: 78, tags: ["kids", "education", "children"] },
  { name: "Boys & Girls Clubs", slug: "bgca", category: "KIDS_ACTIVITY", description: "Youth development programs", website: "https://www.bgca.org", scope: "FEDERAL", popularityScore: 82, tags: ["kids", "children"] },

  // ══════════════════════════════════════════════════════════
  // MOVING & STORAGE
  // ══════════════════════════════════════════════════════════
  { name: "U-Haul", slug: "uhaul", category: "HOUSING_MOVING", description: "Truck and trailer rentals for DIY moving", website: "https://www.uhaul.com", phone: "1-800-468-4285", scope: "FEDERAL", popularityScore: 95, tags: ["moving", "truck", "rental"] },
  { name: "Penske Truck Rental", slug: "penske", category: "HOUSING_MOVING", description: "One-way and local truck rentals", website: "https://www.pensketruckrental.com", phone: "1-800-222-0277", scope: "FEDERAL", popularityScore: 82, tags: ["moving", "truck", "rental"] },
  { name: "Budget Truck Rental", slug: "budget-truck", category: "HOUSING_MOVING", description: "Affordable truck rentals for moving", website: "https://www.budgettruck.com", phone: "1-800-462-8343", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "truck", "rental", "budget"] },
  { name: "PODS", slug: "pods", category: "HOUSING_MOVING", description: "Portable moving and storage containers", website: "https://www.pods.com", phone: "1-866-229-4120", scope: "FEDERAL", popularityScore: 80, tags: ["moving", "storage", "container"] },
  { name: "1-800-GOT-JUNK", slug: "got-junk", category: "HOUSING_MOVING", description: "Junk removal and hauling service", website: "https://www.1800gotjunk.com", phone: "1-800-468-5865", scope: "FEDERAL", popularityScore: 72, tags: ["junk", "removal", "moving"] },
  { name: "Allied Van Lines", slug: "allied-van-lines", category: "HOUSING_MOVING", description: "Full-service interstate moving company", website: "https://www.allied.com", phone: "1-800-689-8684", scope: "FEDERAL", popularityScore: 78, tags: ["moving", "interstate", "full-service"] },
  { name: "United Van Lines", slug: "united-van-lines", category: "HOUSING_MOVING", description: "America's #1 mover", website: "https://www.unitedvanlines.com", phone: "1-800-325-3870", scope: "FEDERAL", popularityScore: 80, tags: ["moving", "interstate", "full-service"] },
  { name: "Two Men and a Truck", slug: "two-men-truck", category: "HOUSING_MOVING", description: "Local and long-distance moving", website: "https://www.twomenandatruck.com", phone: "1-800-345-1070", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "local"] },
  { name: "Mayflower Moving", slug: "mayflower", category: "HOUSING_MOVING", description: "Full-service interstate moving", website: "https://www.mayflower.com", phone: "1-877-720-4498", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "interstate"] },
  { name: "Public Storage", slug: "public-storage", category: "HOUSING_STORAGE", description: "Largest self-storage company in the US", website: "https://www.publicstorage.com", phone: "1-800-688-8057", scope: "FEDERAL", popularityScore: 88, tags: ["storage"] },
  { name: "Extra Space Storage", slug: "extra-space", category: "HOUSING_STORAGE", description: "Self-storage units nationwide", website: "https://www.extraspace.com", phone: "1-888-728-0082", scope: "FEDERAL", popularityScore: 82, tags: ["storage"] },
  { name: "CubeSmart", slug: "cubesmart", category: "HOUSING_STORAGE", description: "Self-storage facilities", website: "https://www.cubesmart.com", phone: "1-844-709-8051", scope: "FEDERAL", popularityScore: 72, tags: ["storage"] },
  { name: "Life Storage", slug: "life-storage", category: "HOUSING_STORAGE", description: "Storage units and moving supplies", website: "https://www.lifestorage.com", phone: "1-844-533-1795", scope: "FEDERAL", popularityScore: 68, tags: ["storage"] },

  // ══════════════════════════════════════════════════════════
  // INVESTMENT & BROKERAGE (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Charles Schwab", slug: "schwab", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Brokerage, banking, and wealth management", website: "https://www.schwab.com", phone: "1-866-855-9102", scope: "FEDERAL", popularityScore: 88, tags: ["investment", "banking", "brokerage"] },
  { name: "Fidelity Investments", slug: "fidelity", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Full-service brokerage and financial services", website: "https://www.fidelity.com", phone: "1-800-343-3548", scope: "FEDERAL", popularityScore: 90, tags: ["investment", "banking", "brokerage"] },
  { name: "Vanguard", slug: "vanguard", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Low-cost index funds and ETFs", website: "https://www.vanguard.com", phone: "1-877-662-7447", scope: "FEDERAL", popularityScore: 85, tags: ["investment", "retirement"] },
  { name: "E*TRADE", slug: "etrade", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Online trading and investing", website: "https://www.etrade.com", phone: "1-800-387-2331", scope: "FEDERAL", popularityScore: 75, tags: ["investment", "trading"] },
  { name: "TD Ameritrade", slug: "td-ameritrade", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Trading platform and investment services", website: "https://www.tdameritrade.com", phone: "1-800-669-3900", scope: "FEDERAL", popularityScore: 78, tags: ["investment", "trading"] },

  // ══════════════════════════════════════════════════════════
  // REAL ESTATE & HOUSING
  // ══════════════════════════════════════════════════════════
  { name: "Zillow", slug: "zillow", category: "HOUSING_REAL_ESTATE", description: "Real estate and rental marketplace", website: "https://www.zillow.com", scope: "FEDERAL", popularityScore: 95, tags: ["real-estate", "home", "rental"] },
  { name: "Realtor.com", slug: "realtor-com", category: "HOUSING_REAL_ESTATE", description: "Official real estate listings", website: "https://www.realtor.com", scope: "FEDERAL", popularityScore: 90, tags: ["real-estate", "home"] },
  { name: "Redfin", slug: "redfin", category: "HOUSING_REAL_ESTATE", description: "Real estate brokerage with lower fees", website: "https://www.redfin.com", scope: "FEDERAL", popularityScore: 85, tags: ["real-estate", "home"] },
  { name: "Apartments.com", slug: "apartments-com", category: "HOUSING_REAL_ESTATE", description: "Apartment and rental listings", website: "https://www.apartments.com", scope: "FEDERAL", popularityScore: 82, tags: ["rental", "apartment"] },
  { name: "Trulia", slug: "trulia", category: "HOUSING_REAL_ESTATE", description: "Real estate listings and neighborhood info", website: "https://www.trulia.com", scope: "FEDERAL", popularityScore: 78, tags: ["real-estate", "home"] },
  { name: "Zumper", slug: "zumper", category: "HOUSING_REAL_ESTATE", description: "Apartment rental platform", website: "https://www.zumper.com", scope: "FEDERAL", popularityScore: 62, tags: ["rental", "apartment"] },

  // ══════════════════════════════════════════════════════════
  // HOME SERVICES
  // ══════════════════════════════════════════════════════════
  { name: "Home Depot", slug: "home-depot", category: "HOUSING_HOME_SERVICE", description: "Home improvement retailer", website: "https://www.homedepot.com", phone: "1-800-466-3337", scope: "FEDERAL", popularityScore: 92, tags: ["home", "improvement"] },
  { name: "Lowe's", slug: "lowes", category: "HOUSING_HOME_SERVICE", description: "Home improvement store", website: "https://www.lowes.com", phone: "1-800-445-6937", scope: "FEDERAL", popularityScore: 88, tags: ["home", "improvement"] },
  { name: "TaskRabbit", slug: "taskrabbit", category: "HOUSING_HOME_SERVICE", description: "Hire local help for moving, assembly, handyman", website: "https://www.taskrabbit.com", scope: "FEDERAL", popularityScore: 75, tags: ["home", "handyman", "moving"] },
  { name: "Thumbtack", slug: "thumbtack", category: "HOUSING_HOME_SERVICE", description: "Find local professionals for any project", website: "https://www.thumbtack.com", scope: "FEDERAL", popularityScore: 72, tags: ["home", "services"] },
  { name: "Angi (Angie's List)", slug: "angi", category: "HOUSING_HOME_SERVICE", description: "Home service professionals", website: "https://www.angi.com", scope: "FEDERAL", popularityScore: 78, tags: ["home", "services"] },
  { name: "Ring", slug: "ring-security", category: "HOUSING_HOME_SERVICE", description: "Video doorbells and home security", website: "https://www.ring.com", scope: "FEDERAL", popularityScore: 82, tags: ["home", "security"] },
  { name: "Roto-Rooter", slug: "roto-rooter", category: "HOUSING_HOME_SERVICE", description: "Plumbing and water cleanup", website: "https://www.rotorooter.com", phone: "1-800-768-6911", scope: "FEDERAL", popularityScore: 72, tags: ["plumbing"] },
  { name: "ServPro", slug: "servpro", category: "HOUSING_HOME_SERVICE", description: "Fire, water, and mold restoration", website: "https://www.servpro.com", phone: "1-800-737-8776", scope: "FEDERAL", popularityScore: 65, tags: ["restoration", "damage"] },
  { name: "Ace Hardware", slug: "ace-hardware", category: "HOUSING_HOME_SERVICE", description: "Local hardware stores plus repair and project services", website: "https://www.acehardware.com", scope: "FEDERAL", popularityScore: 80, tags: ["home", "improvement", "repair"] },
  { name: "True Value", slug: "true-value", category: "HOUSING_HOME_SERVICE", description: "Hardware, paint, and home project supplies", website: "https://www.truevalue.com", scope: "FEDERAL", popularityScore: 70, tags: ["home", "improvement"] },
  { name: "HomeAdvisor", slug: "homeadvisor", category: "HOUSING_HOME_SERVICE", description: "Find local contractors and home repair professionals", website: "https://www.homeadvisor.com", scope: "FEDERAL", popularityScore: 68, tags: ["home", "services"] },
  { name: "Mr. Handyman", slug: "mr-handyman", category: "HOUSING_HOME_SERVICE", description: "Handyman and home repair services", website: "https://www.mrhandyman.com", scope: "FEDERAL", popularityScore: 64, tags: ["home", "handyman", "repair"] },
  { name: "TruGreen", slug: "trugreen", category: "HOUSING_LAWN_CARE", description: "America's #1 lawn care company", website: "https://www.trugreen.com", phone: "1-800-464-0171", scope: "FEDERAL", popularityScore: 88, tags: ["lawn", "home"] },
  { name: "Stanley Steemer", slug: "stanley-steemer", category: "HOUSING_LAWN_CARE", description: "Carpet and floor cleaning", website: "https://www.stanleysteemer.com", phone: "1-800-786-5397", scope: "FEDERAL", popularityScore: 68, tags: ["cleaning", "carpet"] },
  { name: "Terminix", slug: "terminix", category: "HOUSING_PEST_CONTROL", description: "Pest control and termite treatment", website: "https://www.terminix.com", phone: "1-866-569-4035", scope: "FEDERAL", popularityScore: 88, tags: ["pest", "termite"] },
  { name: "Orkin", slug: "orkin", category: "HOUSING_PEST_CONTROL", description: "Pest control since 1901", website: "https://www.orkin.com", phone: "1-877-233-3125", scope: "FEDERAL", popularityScore: 90, tags: ["pest", "home"] },

  // ══════════════════════════════════════════════════════════
  // HOA
  // ══════════════════════════════════════════════════════════
  { name: "FirstService Residential", slug: "firstservice", category: "HOUSING_HOA", description: "Largest HOA management in North America", website: "https://www.fsresidential.com", scope: "FEDERAL", popularityScore: 80, tags: ["hoa", "home"] },
  { name: "Associa", slug: "associa", category: "HOUSING_HOA", description: "Community management company", website: "https://www.associaonline.com", phone: "1-800-808-4882", scope: "FEDERAL", popularityScore: 75, tags: ["hoa", "home"] },

  // ══════════════════════════════════════════════════════════
  // AUTO / TRANSPORTATION
  // ══════════════════════════════════════════════════════════
  { name: "AAA", slug: "aaa", category: "TRANSPORTATION_OTHER", description: "Roadside assistance and auto services", website: "https://www.aaa.com", phone: "1-800-222-4357", scope: "FEDERAL", popularityScore: 90, tags: ["auto", "roadside", "membership"] },
  { name: "E-ZPass", slug: "ezpass", category: "TRANSPORTATION_TOLL", description: "Electronic toll collection (multi-state)", website: "https://www.e-zpassiag.com", scope: "FEDERAL", popularityScore: 85, tags: ["toll", "car", "driving"] },
  { name: "Enterprise Rent-A-Car", slug: "enterprise", category: "TRANSPORTATION_OTHER", description: "Car rental for moving and travel", website: "https://www.enterprise.com", phone: "1-800-736-8222", scope: "FEDERAL", popularityScore: 85, tags: ["car", "rental"] },
  { name: "Hertz", slug: "hertz", category: "TRANSPORTATION_OTHER", description: "Car rental company", website: "https://www.hertz.com", phone: "1-800-654-3131", scope: "FEDERAL", popularityScore: 78, tags: ["car", "rental"] },
  { name: "Carvana", slug: "carvana", category: "TRANSPORTATION_OTHER", description: "Online used car buying and selling", website: "https://www.carvana.com", scope: "FEDERAL", popularityScore: 72, tags: ["auto", "car", "buy"] },
  { name: "CarMax", slug: "carmax", category: "TRANSPORTATION_OTHER", description: "Used car retailer", website: "https://www.carmax.com", phone: "1-800-519-1511", scope: "FEDERAL", popularityScore: 75, tags: ["auto", "car", "buy"] },
  { name: "Jiffy Lube", slug: "jiffy-lube", category: "TRANSPORTATION_AUTO", description: "Oil change and auto maintenance", website: "https://www.jiffylube.com", scope: "FEDERAL", popularityScore: 78, tags: ["car", "auto"] },
  { name: "Safelite AutoGlass", slug: "safelite", category: "TRANSPORTATION_AUTO", description: "Windshield repair and replacement", website: "https://www.safelite.com", phone: "1-800-800-2727", scope: "FEDERAL", popularityScore: 80, tags: ["car", "auto"] },
  { name: "ParkMobile", slug: "parkmobile", category: "TRANSPORTATION_PARKING", description: "Contactless parking payments", website: "https://www.parkmobile.io", scope: "FEDERAL", popularityScore: 82, tags: ["parking", "car"] },

  // ══════════════════════════════════════════════════════════
  // RIDE-SHARE & DELIVERY (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Uber", slug: "uber", category: "TRANSPORTATION_RIDESHARE", description: "Ride-sharing and delivery services", website: "https://www.uber.com", scope: "FEDERAL", popularityScore: 95, tags: ["ride-share", "delivery"] },
  { name: "Lyft", slug: "lyft", category: "TRANSPORTATION_RIDESHARE", description: "Ride-sharing service", website: "https://www.lyft.com", scope: "FEDERAL", popularityScore: 88, tags: ["ride-share"] },
  { name: "Grubhub", slug: "grubhub", category: "LOCAL_DINING", description: "Order delivery and pickup from local restaurants", website: "https://www.grubhub.com", phone: "1-877-585-7878", scope: "FEDERAL", popularityScore: 82, tags: ["dining", "delivery"] },

  // ══════════════════════════════════════════════════════════
  // SHOPPING / RETAIL
  // ══════════════════════════════════════════════════════════
  { name: "Walmart", slug: "walmart", category: "SHOPPING_RETAIL", description: "Everyday low prices, groceries and more", website: "https://www.walmart.com", phone: "1-800-925-6278", scope: "FEDERAL", popularityScore: 98, tags: ["shopping", "grocery"] },
  { name: "Target", slug: "target", category: "SHOPPING_RETAIL", description: "Expect more, pay less", website: "https://www.target.com", phone: "1-800-440-0680", scope: "FEDERAL", popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "IKEA", slug: "ikea", category: "SHOPPING_RETAIL", description: "Furniture and home goods", website: "https://www.ikea.com/us", phone: "1-888-888-4532", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "home"] },
  { name: "Best Buy", slug: "best-buy", category: "SHOPPING_RETAIL", description: "Electronics and technology", website: "https://www.bestbuy.com", phone: "1-888-237-8289", scope: "FEDERAL", popularityScore: 85, tags: ["shopping"] },
  { name: "Kohl's", slug: "kohls", category: "SHOPPING_RETAIL", description: "Department store shopping, rewards, and store card account management", website: "https://www.kohls.com", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "retail", "credit-card"] },
  { name: "Staples", slug: "staples", category: "SHOPPING_RETAIL", description: "Office supplies, print services, and business account shopping", website: "https://www.staples.com", scope: "FEDERAL", popularityScore: 78, tags: ["shopping", "office", "business"] },
  { name: "Macy's", slug: "macys", category: "SHOPPING_RETAIL", description: "Department store shopping, rewards, and store card account management", website: "https://www.macys.com", scope: "FEDERAL", popularityScore: 78, tags: ["shopping", "retail", "credit-card"] },
  { name: "Nordstrom", slug: "nordstrom", category: "SHOPPING_RETAIL", description: "Department store shopping, rewards, and account profile management", website: "https://www.nordstrom.com", scope: "FEDERAL", popularityScore: 74, tags: ["shopping", "retail"] },
  { name: "Ulta Beauty", slug: "ulta-beauty", category: "SHOPPING_RETAIL", description: "Beauty, salon, wellness, and rewards account shopping", website: "https://www.ulta.com", scope: "FEDERAL", popularityScore: 76, tags: ["shopping", "beauty", "wellness"] },
  { name: "Sephora", slug: "sephora", category: "SHOPPING_RETAIL", description: "Beauty and wellness retailer with rewards account management", website: "https://www.sephora.com", scope: "FEDERAL", popularityScore: 78, tags: ["shopping", "beauty", "wellness"] },
  { name: "GNC", slug: "gnc", category: "SHOPPING_RETAIL", description: "Vitamins, supplements, and wellness product shopping", website: "https://www.gnc.com", scope: "FEDERAL", popularityScore: 70, tags: ["shopping", "supplements", "wellness"] },
  { name: "The Vitamin Shoppe", slug: "vitamin-shoppe", category: "SHOPPING_RETAIL", description: "Vitamins, supplements, and wellness product shopping", website: "https://www.vitaminshoppe.com", scope: "FEDERAL", popularityScore: 68, tags: ["shopping", "supplements", "wellness"] },
  { name: "iHerb", slug: "iherb", category: "SHOPPING_RETAIL", description: "Online vitamins, supplements, and wellness store", website: "https://www.iherb.com", scope: "FEDERAL", popularityScore: 66, tags: ["shopping", "supplements", "wellness"] },
  { name: "Trader Joe's", slug: "trader-joes", category: "SHOPPING_RETAIL", description: "Specialty grocery chain", website: "https://www.traderjoes.com", scope: "FEDERAL", popularityScore: 88, tags: ["shopping", "grocery"] },
  { name: "Whole Foods Market", slug: "whole-foods", category: "SHOPPING_RETAIL", description: "Natural and organic foods by Amazon", website: "https://www.wholefoodsmarket.com", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "grocery"] },
  { name: "Aldi", slug: "aldi", category: "SHOPPING_RETAIL", description: "Discount grocery stores", website: "https://www.aldi.us", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery", "budget"] },

  // ══════════════════════════════════════════════════════════
  // CONVENIENCE / GAS STATIONS (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Wawa", slug: "wawa", category: "SHOPPING_RETAIL", description: "Convenience store and gas (PA, NJ, DE, MD, VA, DC, FL)", website: "https://www.wawa.com", scope: "FEDERAL", popularityScore: 82, tags: ["convenience", "gas"] },
  { name: "Sheetz", slug: "sheetz", category: "SHOPPING_RETAIL", description: "Convenience store and gas (PA, WV, VA, MD, OH, NC)", website: "https://www.sheetz.com", scope: "FEDERAL", popularityScore: 78, tags: ["convenience", "gas"] },
  { name: "7-Eleven", slug: "7-eleven", category: "SHOPPING_RETAIL", description: "Convenience stores worldwide", website: "https://www.7-eleven.com", scope: "FEDERAL", popularityScore: 85, tags: ["convenience"] },
  { name: "Circle K", slug: "circle-k", category: "SHOPPING_RETAIL", description: "Convenience stores and gas stations", website: "https://www.circlek.com", scope: "FEDERAL", popularityScore: 78, tags: ["convenience", "gas"] },

  // ══════════════════════════════════════════════════════════
  // IDENTITY PROTECTION (NEW CATEGORY)
  // ══════════════════════════════════════════════════════════
  { name: "LifeLock (Norton)", slug: "lifelock", category: "SECURITY_IDENTITY", description: "Identity theft protection and credit monitoring", website: "https://www.lifelock.com", phone: "1-800-543-3562", scope: "FEDERAL", popularityScore: 88, tags: ["identity", "security"] },
  { name: "Aura", slug: "aura-identity", category: "SECURITY_IDENTITY", description: "All-in-one digital security and identity protection", website: "https://www.aura.com", scope: "FEDERAL", popularityScore: 82, tags: ["identity", "security"] },
  { name: "IdentityForce", slug: "identityforce", category: "SECURITY_IDENTITY", description: "Identity theft protection service", website: "https://www.identityforce.com", scope: "FEDERAL", popularityScore: 72, tags: ["identity", "security"] },
  { name: "Identity Guard", slug: "identity-guard", category: "SECURITY_IDENTITY", description: "AI-powered identity theft protection", website: "https://www.identityguard.com", scope: "FEDERAL", popularityScore: 70, tags: ["identity", "security"] },

  // ══════════════════════════════════════════════════════════
  // ONLINE EDUCATION (NEW CATEGORY)
  // ══════════════════════════════════════════════════════════
  { name: "Coursera", slug: "coursera", category: "EDUCATION_ONLINE", description: "Online courses from top universities", website: "https://www.coursera.org", scope: "FEDERAL", popularityScore: 85, tags: ["education", "online"] },
  { name: "Udemy", slug: "udemy", category: "EDUCATION_ONLINE", description: "Online learning marketplace", website: "https://www.udemy.com", scope: "FEDERAL", popularityScore: 82, tags: ["education", "online"] },
  { name: "LinkedIn Learning", slug: "linkedin-learning", category: "EDUCATION_ONLINE", description: "Professional development courses", website: "https://www.linkedin.com/learning", scope: "FEDERAL", popularityScore: 80, tags: ["education", "online"] },
  { name: "Skillshare", slug: "skillshare", category: "EDUCATION_ONLINE", description: "Creative and business classes", website: "https://www.skillshare.com", scope: "FEDERAL", popularityScore: 72, tags: ["education", "online"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: DEEPEN CRITICAL FEDERAL CATEGORIES (2026-04-17)
  // ══════════════════════════════════════════════════════════

  // ── HEALTHCARE_VET (specialty + telehealth) ──
  { name: "BluePearl Pet Hospital", slug: "bluepearl", category: "HEALTHCARE_VET", description: "24/7 emergency and specialty veterinary care", website: "https://bluepearlvet.com", phone: "1-855-880-6082", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "vet", "emergency"] },
  { name: "Chewy Connect with a Vet", slug: "chewy-vet", category: "HEALTHCARE_VET", description: "Virtual vet consultations for Chewy customers", website: "https://www.chewy.com/app/content/connect-with-a-vet", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "vet", "telehealth"] },
  { name: "Dutch", slug: "dutch-vet", category: "HEALTHCARE_VET", description: "Online vet for dogs and cats — 24/7 telehealth", website: "https://www.dutch.com", scope: "FEDERAL", popularityScore: 62, tags: ["pet", "vet", "telehealth"] },
  { name: "1-800-PetMeds", slug: "petmeds", category: "HEALTHCARE_VET", description: "Pet pharmacy and prescriptions", website: "https://www.1800petmeds.com", phone: "1-800-738-6337", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "vet", "pharmacy"] },

  // ── KIDS_SCHOOL (research tools) ──
  { name: "GreatSchools", slug: "greatschools", category: "KIDS_SCHOOL", description: "Ratings and research on K-12 public and private schools", website: "https://www.greatschools.org", scope: "FEDERAL", popularityScore: 82, tags: ["kids", "education", "children", "research"] },
  { name: "Niche", slug: "niche", category: "KIDS_SCHOOL", description: "K-12 and college rankings, reviews, and research", website: "https://www.niche.com", scope: "FEDERAL", popularityScore: 78, tags: ["kids", "education", "children", "research"] },

  // ── KIDS_DAYCARE (expansion) ──
  { name: "Sittercity", slug: "sittercity", category: "KIDS_DAYCARE", description: "Find babysitters, nannies, and pet sitters", website: "https://www.sittercity.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "daycare", "children", "pet"] },

  // ── FINANCIAL_MORTGAGE (lender depth) ──
  { name: "loanDepot", slug: "loandepot", category: "FINANCIAL_MORTGAGE", description: "National mortgage lender — purchase and refinance", website: "https://www.loandepot.com", phone: "1-888-337-6888", scope: "FEDERAL", popularityScore: 70, tags: ["mortgage", "home", "loan"] },
  { name: "Guild Mortgage", slug: "guild-mortgage", category: "FINANCIAL_MORTGAGE", description: "Home loans, refinancing, and first-time buyer programs", website: "https://www.guildmortgage.com", phone: "1-800-365-4884", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home", "loan"] },
  { name: "AmeriSave Mortgage", slug: "amerisave", category: "FINANCIAL_MORTGAGE", description: "Direct-to-consumer online mortgage lender", website: "https://www.amerisave.com", phone: "1-866-865-2141", scope: "FEDERAL", popularityScore: 62, tags: ["mortgage", "home", "loan", "online"] },
  { name: "PennyMac", slug: "pennymac", category: "FINANCIAL_MORTGAGE", description: "Top mortgage lender and servicer", website: "https://www.pennymacusa.com", phone: "1-866-549-3583", scope: "FEDERAL", popularityScore: 68, tags: ["mortgage", "home", "loan"] },

  // ── FINANCIAL_INSURANCE_FLOOD (private carriers) ──
  { name: "Neptune Flood", slug: "neptune-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Private flood insurance — alternative to NFIP", website: "https://neptuneflood.com", phone: "1-727-202-4815", scope: "FEDERAL", popularityScore: 68, tags: ["home", "insurance", "flood"] },
  { name: "Assurant Flood Solutions", slug: "assurant-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Flood insurance through Assurant partners", website: "https://www.assurant.com", scope: "FEDERAL", popularityScore: 60, tags: ["home", "insurance", "flood"] },
  { name: "SelectQuote Flood", slug: "selectquote-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Compare flood insurance quotes from multiple carriers", website: "https://www.selectquote.com", phone: "1-855-653-0942", scope: "FEDERAL", popularityScore: 58, tags: ["home", "insurance", "flood"] },
];

export const STATE_DMVS = [
  { name: "Alabama DMV", slug: "dmv-al", states: ["AL"], website: "https://www.alea.gov", phone: "1-334-242-4400", description: "Alabama Law Enforcement Agency - Driver License", popularityScore: 90 },
  { name: "Alaska DMV", slug: "dmv-ak", states: ["AK"], website: "https://doa.alaska.gov/dmv", phone: "1-907-269-5551", description: "Alaska Division of Motor Vehicles", popularityScore: 85 },
  { name: "Arizona Department of Transportation Motor Vehicle Division", slug: "dmv-az", states: ["AZ"], website: "https://azdot.gov/mvd/services/driver-license-ID/change-your-address", phone: "1-602-255-0072", description: "Arizona driver license, ID, vehicle registration, title, out-of-state registration, and address-change services", popularityScore: 92 },
  { name: "Arkansas Department of Finance and Administration - MyDMV", slug: "dmv-ar", states: ["AR"], website: "https://www.dfa.arkansas.gov/office/mydmv/", phone: "1-501-682-4692", description: "Arkansas driver license, ID, vehicle registration, renewal mailing-address, and address-change services through DFA MyDMV", popularityScore: 88 },
  { name: "California DMV", slug: "dmv-ca", states: ["CA"], website: "https://www.dmv.ca.gov", phone: "1-800-777-0133", description: "California Department of Motor Vehicles, including New to California resident driver license, ID, and vehicle registration guidance", popularityScore: 98 },
  { name: "Colorado Division of Motor Vehicles", slug: "dmv-co", states: ["CO"], website: "https://dmv.colorado.gov/change-your-address", phone: "1-303-205-5600", description: "Colorado driver license, ID, address-change, title, and vehicle registration services", popularityScore: 90 },
  { name: "Connecticut Department of Motor Vehicles", slug: "dmv-ct", states: ["CT"], website: "https://portal.ct.gov/dmv/licenses-permits-ids/change-driver-license", phone: "1-860-263-5700", description: "Connecticut driver license, ID, vehicle registration, address-change, and new-resident transfer services", popularityScore: 88 },
  { name: "Delaware DMV", slug: "dmv-de", states: ["DE"], website: "https://www.dmv.de.gov", phone: "1-302-744-2500", description: "Delaware Division of Motor Vehicles", popularityScore: 85 },
  { name: "DC DMV", slug: "dmv-dc", states: ["DC"], website: "https://dmv.dc.gov", phone: "1-202-737-4404", description: "District of Columbia DMV", popularityScore: 88 },
  { name: "Florida Highway Safety and Motor Vehicles", slug: "dmv-fl", states: ["FL"], website: "https://www.flhsmv.gov/name-and-address-changes/", phone: "1-850-617-2000", description: "Florida driver license, ID, vehicle title, registration, and address-change services", popularityScore: 95 },
  { name: "Georgia Department of Driver Services", slug: "dmv-ga", states: ["GA"], website: "https://dds.georgia.gov/georgia-licenseid/existing-licenseid/how-do-i-update-license", phone: "1-678-413-8400", description: "Georgia driver license, permit, ID, and address-change services", popularityScore: 92 },
  { name: "Hawaii DOT Driver Licensing / County DMV Directory", slug: "dmv-hi", states: ["HI"], website: "https://hidot.hawaii.gov/driverslicense/", description: "State Hawaii driver licensing guidance and county DMV office directory", popularityScore: 82 },
  { name: "Idaho DMV", slug: "dmv-id", states: ["ID"], website: "https://itd.idaho.gov/dmv", phone: "1-208-334-8000", description: "Idaho Transportation Department", popularityScore: 85 },
  { name: "Illinois SOS", slug: "dmv-il", states: ["IL"], website: "https://www.ilsos.gov", phone: "1-800-252-8980", description: "Illinois Secretary of State Driver Services", popularityScore: 92 },
  { name: "Indiana BMV", slug: "dmv-in", states: ["IN"], website: "https://www.in.gov/bmv", phone: "1-888-692-6841", description: "Indiana Bureau of Motor Vehicles", popularityScore: 88 },
  { name: "Iowa DOT", slug: "dmv-ia", states: ["IA"], website: "https://iowadot.gov/mvd", phone: "1-800-532-1121", description: "Iowa Dept of Transportation Motor Vehicle", popularityScore: 85 },
  { name: "Kansas DMV", slug: "dmv-ks", states: ["KS"], website: "https://www.ksrevenue.gov/dovindex.html", phone: "1-785-296-3963", description: "Kansas Division of Vehicles", popularityScore: 85 },
  { name: "Kentucky DMV", slug: "dmv-ky", states: ["KY"], website: "https://drive.ky.gov", phone: "1-502-564-1257", description: "Kentucky Transportation Cabinet", popularityScore: 85 },
  { name: "Louisiana OMV", slug: "dmv-la", states: ["LA"], website: "https://expresslane.org", phone: "1-877-368-5463", description: "Louisiana Office of Motor Vehicles", popularityScore: 88 },
  { name: "Maine BMV", slug: "dmv-me", states: ["ME"], website: "https://www.maine.gov/sos/bmv", phone: "1-207-624-9000", description: "Maine Bureau of Motor Vehicles", popularityScore: 82 },
  { name: "Maryland Department of Transportation Motor Vehicle Administration", slug: "dmv-md", states: ["MD"], website: "https://mva.maryland.gov/your-mva-guide/new-maryland-residents/title-register-your-vehicle", phone: "1-410-768-7000", description: "Maryland driver license, address-change, title, and vehicle registration services", popularityScore: 90 },
  { name: "Massachusetts Registry of Motor Vehicles (RMV)", slug: "dmv-ma", states: ["MA"], website: "https://www.mass.gov/how-to/change-your-address-with-the-rmv", phone: "1-857-368-8000", description: "Massachusetts driver license, ID, address-change, title, and registration services", popularityScore: 92 },
  { name: "Michigan SOS", slug: "dmv-mi", states: ["MI"], website: "https://www.michigan.gov/sos", phone: "1-888-767-6424", description: "Michigan Secretary of State", popularityScore: 90 },
  { name: "Minnesota DVS", slug: "dmv-mn", states: ["MN"], website: "https://dps.mn.gov/dvs", phone: "1-651-297-3298", description: "Minnesota Driver and Vehicle Services", popularityScore: 88 },
  { name: "Mississippi DPS", slug: "dmv-ms", states: ["MS"], website: "https://www.dps.state.ms.us", phone: "1-601-987-1212", description: "Mississippi Dept of Public Safety", popularityScore: 82 },
  { name: "Missouri DMV", slug: "dmv-mo", states: ["MO"], website: "https://dor.mo.gov/motor-vehicle", phone: "1-573-526-3669", description: "Missouri Dept of Revenue Motor Vehicle", popularityScore: 88 },
  { name: "Montana MVD", slug: "dmv-mt", states: ["MT"], website: "https://dojmt.gov/driving", phone: "1-406-444-3933", description: "Montana Motor Vehicle Division", popularityScore: 80 },
  { name: "Nebraska DMV", slug: "dmv-ne", states: ["NE"], website: "https://dmv.nebraska.gov", phone: "1-402-471-3861", description: "Nebraska Dept of Motor Vehicles", popularityScore: 85 },
  { name: "Nevada Department of Motor Vehicles", slug: "dmv-nv", states: ["NV"], website: "https://dmv.nv.gov/newresident.htm", phone: "1-702-486-4368", description: "Nevada driver license, ID, address-change, vehicle registration, title, and new-resident services", popularityScore: 90 },
  { name: "New Hampshire Division of Motor Vehicles", slug: "dmv-nh", states: ["NH"], website: "https://www.dmv.nh.gov/drivers-licensenon-driver-ids/update-personal-information", phone: "1-603-227-4000", description: "New Hampshire driver license, ID, address-change, title, and registration services", popularityScore: 88 },
  { name: "New Jersey MVC", slug: "dmv-nj", states: ["NJ"], website: "https://www.nj.gov/mvc", phone: "1-609-292-6500", description: "New Jersey Motor Vehicle Commission", popularityScore: 92 },
  { name: "New Mexico MVD", slug: "dmv-nm", states: ["NM"], website: "https://www.mvd.newmexico.gov", phone: "1-888-683-4636", description: "New Mexico Motor Vehicle Division", popularityScore: 85 },
  { name: "New York DMV", slug: "dmv-ny", states: ["NY"], website: "https://dmv.ny.gov", phone: "1-518-486-9786", description: "New York Department of Motor Vehicles", popularityScore: 95 },
  { name: "North Carolina Division of Motor Vehicles", slug: "dmv-nc", states: ["NC"], website: "https://www.ncdot.gov/dmv/help/moving/Pages/default.aspx", phone: "1-919-715-7000", description: "North Carolina driver license, ID, title, registration, new-resident, and address-change services", popularityScore: 92 },
  { name: "North Dakota DOT", slug: "dmv-nd", states: ["ND"], website: "https://www.dot.nd.gov/divisions/drivers", phone: "1-701-328-2725", description: "North Dakota Drivers License Division", popularityScore: 80 },
  { name: "Ohio Bureau of Motor Vehicles", slug: "dmv-oh", states: ["OH"], website: "https://bmvonline.dps.ohio.gov/", phone: "1-844-644-6268", description: "Ohio driver license, ID, title, registration, plate renewal, new-resident, and address-change services", popularityScore: 90 },
  { name: "Oklahoma DPS", slug: "dmv-ok", states: ["OK"], website: "https://oklahoma.gov/dps", phone: "1-405-425-2424", description: "Oklahoma Dept of Public Safety", popularityScore: 85 },
  { name: "Oregon Driver & Motor Vehicle Services", slug: "dmv-or", states: ["OR"], website: "https://www.oregon.gov/odot/dmv/pages/dv/chgaddress.aspx", phone: "1-503-945-5000", description: "Oregon driver license, ID, address-change, vehicle registration, renewal, and transfer services", popularityScore: 90 },
  { name: "PennDOT Driver & Vehicle Services", slug: "dmv-pa", states: ["PA"], website: "https://www.pa.gov/agencies/dmv/resources/relocation/moving-within-pa", phone: "1-717-412-5300", description: "Pennsylvania driver license, photo ID, address-change, title, and registration relocation services", popularityScore: 92 },
  { name: "Rhode Island DMV", slug: "dmv-ri", states: ["RI"], website: "https://dmv.ri.gov", phone: "1-401-462-4368", description: "Rhode Island Division of Motor Vehicles", popularityScore: 82 },
  { name: "South Carolina Department of Motor Vehicles", slug: "dmv-sc", states: ["SC"], website: "https://dmv.sc.gov/driver-services/moving-to-sc", phone: "1-803-896-5000", description: "South Carolina driver license, ID, title, registration, new-resident, and address-change services", popularityScore: 88 },
  { name: "South Dakota DPS", slug: "dmv-sd", states: ["SD"], website: "https://dps.sd.gov/driver-licensing", phone: "1-605-773-6883", description: "South Dakota Driver Licensing", popularityScore: 80 },
  { name: "Tennessee DOR", slug: "dmv-tn", states: ["TN"], website: "https://www.tn.gov/revenue/title-and-registration", phone: "1-615-741-3101", description: "Tennessee Dept of Revenue Driver Services", popularityScore: 88 },
  { name: "Texas DPS", slug: "dmv-tx", states: ["TX"], website: "https://www.dps.texas.gov/section/driver-license", phone: "1-512-424-2600", description: "Texas Dept of Public Safety Driver License", popularityScore: 95 },
  { name: "Utah Driver License Division", slug: "dmv-ut", states: ["UT"], website: "https://dld.utah.gov/address-change-regular/", phone: "1-801-965-4437", description: "Utah driver license, ID, CDL, and driver address-change services", popularityScore: 86 },
  { name: "Vermont DMV", slug: "dmv-vt", states: ["VT"], website: "https://dmv.vermont.gov", phone: "1-802-828-2000", description: "Vermont Dept of Motor Vehicles", popularityScore: 82 },
  { name: "Virginia Department of Motor Vehicles", slug: "dmv-va", states: ["VA"], website: "https://www.dmv.virginia.gov/online-services/address-change", phone: "1-804-497-7100", description: "Virginia driver license, ID, vehicle registration, title, new-resident, and address-change services", popularityScore: 92 },
  { name: "Washington State Department of Licensing", slug: "dmv-wa", states: ["WA"], website: "https://dol.wa.gov/moving-washington", phone: "1-360-902-3900", description: "Washington driver license, ID, vehicle title, registration, and address-change services", popularityScore: 90 },
  { name: "West Virginia DMV", slug: "dmv-wv", states: ["WV"], website: "https://transportation.wv.gov/dmv", phone: "1-800-642-9066", description: "West Virginia Division of Motor Vehicles", popularityScore: 82 },
  { name: "Wisconsin DMV", slug: "dmv-wi", states: ["WI"], website: "https://wisconsindot.gov/pages/dmv", phone: "1-608-264-7447", description: "Wisconsin Division of Motor Vehicles", popularityScore: 88 },
  { name: "Wyoming DMV", slug: "dmv-wy", states: ["WY"], website: "https://www.dot.state.wy.us", phone: "1-307-777-4800", description: "Wyoming Dept of Transportation", popularityScore: 80 },
];

// ============================================================
// STATE-LEVEL PROVIDERS (utilities, transit, health, toll, ISP)
// Consolidated from seed-providers.ts + seed-providers-all-states.ts
// + seed-providers-expanded.ts + new additions
// ============================================================
export const STATE_PROVIDERS = [
  // ── New Jersey ──
  { name: "PSE&G", slug: "pseg", category: "UTILITY_ELECTRIC", description: "Public Service Electric and Gas", website: "https://www.pseg.com", phone: "1-800-436-7734", scope: "STATE", states: ["NJ"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "JCP&L", slug: "jcpl", category: "UTILITY_ELECTRIC", description: "Jersey Central Power & Light", website: "https://www.firstenergycorp.com/jcpl", phone: "1-800-662-3115", scope: "STATE", states: ["NJ"], popularityScore: 70, tags: ["electric"] },
  { name: "New Jersey American Water", slug: "nj-american-water", category: "UTILITY_WATER", description: "Water utility for NJ", website: "https://www.amwater.com/njaw", phone: "1-800-652-6987", scope: "STATE", states: ["NJ"], popularityScore: 80, tags: ["water"] },
  { name: "NJ E-ZPass", slug: "nj-ezpass", category: "TRANSPORTATION_TOLL", description: "NJ Turnpike toll pass", website: "https://www.ezpassnj.com", phone: "1-888-288-6865", scope: "STATE", states: ["NJ"], popularityScore: 90, tags: ["toll", "car", "driving"] },
  { name: "NJ Transit", slug: "nj-transit", category: "TRANSPORTATION_TRANSIT", description: "NJ public transportation", website: "https://www.njtransit.com", phone: "1-973-275-5555", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["transit", "bus", "train"] },
  { name: "Elizabethtown Gas", slug: "elizabethtown-gas", category: "UTILITY_GAS", description: "Natural gas utility NJ", website: "https://www.southerncompanygas.com/elizabethtown-gas", scope: "STATE", states: ["NJ"], popularityScore: 65, tags: ["gas"] },
  { name: "Horizon BCBS NJ", slug: "horizon-bcbs-nj", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of New Jersey", website: "https://www.horizonblue.com", phone: "1-800-355-2583", scope: "STATE", states: ["NJ"], popularityScore: 88, tags: ["health"] },
  { name: "NJ Natural Gas", slug: "njng", category: "UTILITY_GAS", description: "New Jersey Natural Gas", website: "https://www.njng.com", phone: "1-800-221-0051", scope: "STATE", states: ["NJ"], popularityScore: 72, tags: ["gas"] },
  { name: "GetCoveredNJ", slug: "getcoverednj", category: "FINANCIAL_INSURANCE_HEALTH", description: "NJ Health Insurance Marketplace", website: "https://www.getcovered.nj.gov", scope: "STATE", states: ["NJ"], popularityScore: 78, tags: ["health", "marketplace"] },
  { name: "NJ Division of Taxation", slug: "nj-tax", category: "GOVERNMENT_TAX", description: "NJ state income tax", website: "https://www.nj.gov/treasury/taxation", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["tax", "government"] },

  // ── New York ──
  { name: "Con Edison", slug: "con-edison", category: "UTILITY_ELECTRIC", description: "Consolidated Edison", website: "https://www.coned.com", phone: "1-800-752-6633", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "National Grid Upstate New York", slug: "national-grid-ny", category: "UTILITY_ELECTRIC", description: "Upstate New York electric and natural gas utility account support", website: "https://www.nationalgridus.com/Upstate-NY-Home", phone: "1-800-642-4272", scope: "STATE", states: ["NY"], zipCodes: ["120", "121", "122", "123", "128", "129", "130", "131", "132", "133", "134", "135", "136", "140", "141", "142", "143"], popularityScore: 78, tags: ["electric", "gas", "utility", "upstate-new-york", "address-check"] },
  { name: "NYC Water Board", slug: "nyc-water", category: "UTILITY_WATER", description: "NYC water and sewer", website: "https://www1.nyc.gov/site/dep", scope: "STATE", states: ["NY"], popularityScore: 85, tags: ["water"] },
  { name: "MTA", slug: "mta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Transportation Authority", website: "https://www.mta.info", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["transit", "subway", "bus"] },
  { name: "NY E-ZPass", slug: "ny-ezpass", category: "TRANSPORTATION_TOLL", description: "New York toll pass", website: "https://www.e-zpassny.com", scope: "STATE", states: ["NY"], popularityScore: 88, tags: ["toll", "car"] },
  { name: "Optimum", slug: "optimum", category: "UTILITY_INTERNET", description: "Internet and TV for NY/NJ/CT", website: "https://www.optimum.com", phone: "1-866-347-4784", scope: "STATE", states: ["NY", "NJ", "CT"], popularityScore: 72, tags: ["internet", "cable", "tv"] },
  { name: "NY State of Health", slug: "ny-health-marketplace", category: "FINANCIAL_INSURANCE_HEALTH", description: "NY Health Insurance Marketplace", website: "https://nystateofhealth.ny.gov", scope: "STATE", states: ["NY"], popularityScore: 80, tags: ["health", "marketplace"] },

  // ── Texas ──
  { name: "TXU Energy", slug: "txu-energy", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.txu.com", phone: "1-800-818-6132", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["electric"] },
  { name: "Reliant Energy", slug: "reliant", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.reliant.com", phone: "1-866-222-7100", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["electric"] },
  { name: "CenterPoint Energy", slug: "centerpoint", category: "UTILITY_GAS", description: "Natural gas delivery in TX", website: "https://www.centerpointenergy.com", phone: "1-800-332-7143", scope: "STATE", states: ["TX"], popularityScore: 80, tags: ["gas"] },
  { name: "TxTag", slug: "txtag", category: "TRANSPORTATION_TOLL", description: "Texas toll tag", website: "https://www.txtag.org", phone: "1-888-468-9824", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["toll", "car", "driving"] },
  { name: "DART", slug: "dart", category: "TRANSPORTATION_TRANSIT", description: "Dallas Area Rapid Transit", website: "https://www.dart.org", phone: "1-214-979-1111", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus", "train"] },
  { name: "BCBS Texas", slug: "bcbs-tx", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Texas", website: "https://www.bcbstx.com", phone: "1-800-521-2227", scope: "STATE", states: ["TX"], popularityScore: 85, tags: ["health"] },
  { name: "H-E-B", slug: "heb", category: "SHOPPING_RETAIL", description: "Texas-based supermarket chain", website: "https://www.heb.com", scope: "STATE", states: ["TX"], popularityScore: 95, tags: ["shopping", "grocery"] },
  { name: "Austin Water", slug: "austin-water", category: "UTILITY_WATER", description: "Water utility for Austin", website: "https://www.austintexas.gov/department/water", phone: "1-512-972-0000", scope: "STATE", states: ["TX"], popularityScore: 75, tags: ["water"] },
  { name: "Dallas Water Utilities", slug: "dallas-water", category: "UTILITY_WATER", description: "Water for Dallas metro", website: "https://www.dallascityhall.com/departments/waterutilities", phone: "1-214-651-1441", scope: "STATE", states: ["TX"], popularityScore: 78, tags: ["water"] },
  { name: "Houston Public Works", slug: "houston-water", category: "UTILITY_WATER", description: "Water for Houston", website: "https://www.houstontx.gov/publicworks", phone: "1-713-371-8834", scope: "STATE", states: ["TX"], popularityScore: 80, tags: ["water"] },
  { name: "San Antonio Water System", slug: "saws", category: "UTILITY_WATER", description: "SAWS water utility", website: "https://www.saws.org", phone: "1-210-704-7297", scope: "STATE", states: ["TX"], popularityScore: 72, tags: ["water"] },
  { name: "Atmos Energy", slug: "atmos-energy", category: "UTILITY_GAS", description: "Natural gas for Texas", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["TX"], popularityScore: 78, tags: ["gas"] },
  { name: "Houston METRO", slug: "metro-houston", category: "TRANSPORTATION_TRANSIT", description: "Houston public transit", website: "https://www.ridemetro.org", phone: "1-713-635-4000", scope: "STATE", states: ["TX"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "VIA Metropolitan Transit", slug: "via-sa", category: "TRANSPORTATION_TRANSIT", description: "San Antonio public transit", website: "https://www.viainfo.net", phone: "1-210-362-2020", scope: "STATE", states: ["TX"], popularityScore: 70, tags: ["transit", "bus"] },
  { name: "CapMetro", slug: "capmetro", category: "TRANSPORTATION_TRANSIT", description: "Austin public transit", website: "https://www.capmetro.org", phone: "1-512-474-1200", scope: "STATE", states: ["TX"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "Trinity Metro", slug: "trinity-metro", category: "TRANSPORTATION_TRANSIT", description: "Fort Worth public transit", website: "https://ridetrinitymetro.org", phone: "1-817-215-8600", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus"] },

  // ── California ──
  { name: "PG&E", slug: "pge", category: "UTILITY_ELECTRIC", description: "Northern and Central California electric and natural gas utility account support; confirm service availability by address", website: "https://www.pge.com", phone: "1-877-660-6789", scope: "STATE", states: ["CA"], popularityScore: 92, tags: ["electric", "gas", "utility", "address-check"] },
  { name: "Southern California Edison", slug: "sce", category: "UTILITY_ELECTRIC", description: "Southern California electric utility account support; confirm service availability by address", website: "https://www.sce.com", phone: "1-800-655-4555", scope: "STATE", states: ["CA"], popularityScore: 88, tags: ["electric", "utility", "address-check"] },
  { name: "SoCalGas", slug: "socalgas", category: "UTILITY_GAS", description: "Southern California natural gas utility account support; confirm service availability by address", website: "https://www.socalgas.com", phone: "1-877-238-0092", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["gas", "utility", "address-check"] },
  { name: "LADWP", slug: "ladwp", category: "UTILITY_WATER", description: "City of Los Angeles water and electric utility account support; confirm service availability by address", website: "https://www.ladwp.com", phone: "1-800-342-5397", scope: "STATE", states: ["CA"], popularityScore: 82, tags: ["water", "electric", "utility", "los-angeles", "address-check"] },
  { name: "Bay Area FasTrak", slug: "fastrak", category: "TRANSPORTATION_TOLL", description: "Bay Area FasTrak toll account for bridges, express lanes, vehicles, payments, and mailing details", website: "https://www.bayareafastrak.org", phone: "1-877-229-8655", scope: "STATE", states: ["CA"], zipCodes: ["940", "941", "942", "943", "944", "945", "946", "947", "948", "949", "950", "951"], popularityScore: 85, tags: ["toll", "car", "driving", "bay-area"] },
  { name: "LA Metro", slug: "la-metro", category: "TRANSPORTATION_TRANSIT", description: "Los Angeles Metro", website: "https://www.metro.net", scope: "STATE", states: ["CA"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "BART", slug: "bart", category: "TRANSPORTATION_TRANSIT", description: "Bay Area Rapid Transit", website: "https://www.bart.gov", scope: "STATE", states: ["CA"], popularityScore: 78, tags: ["transit", "train"] },
  { name: "SF Muni", slug: "muni", category: "TRANSPORTATION_TRANSIT", description: "San Francisco Municipal Railway", website: "https://www.sfmta.com", phone: "1-415-701-2311", scope: "STATE", states: ["CA"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "Caltrain", slug: "caltrain", category: "TRANSPORTATION_TRANSIT", description: "SF to San Jose commuter rail", website: "https://www.caltrain.com", phone: "1-800-660-4287", scope: "STATE", states: ["CA"], popularityScore: 72, tags: ["transit", "train"] },
  { name: "San Diego MTS", slug: "mts-sd", category: "TRANSPORTATION_TRANSIT", description: "San Diego bus and trolley", website: "https://www.sdmts.com", phone: "1-619-233-3004", scope: "STATE", states: ["CA"], popularityScore: 70, tags: ["transit", "bus", "train"] },
  { name: "AC Transit", slug: "ac-transit", category: "TRANSPORTATION_TRANSIT", description: "Alameda-Contra Costa bus", website: "https://www.actransit.org", phone: "1-510-891-4777", scope: "STATE", states: ["CA"], popularityScore: 68, tags: ["transit", "bus"] },
  { name: "VTA", slug: "vta", category: "TRANSPORTATION_TRANSIT", description: "Silicon Valley transit", website: "https://www.vta.org", phone: "1-408-321-2300", scope: "STATE", states: ["CA"], popularityScore: 68, tags: ["transit", "bus", "train"] },
  { name: "Covered California", slug: "covered-ca", category: "FINANCIAL_INSURANCE_HEALTH", description: "CA health insurance marketplace", website: "https://www.coveredca.com", phone: "1-800-300-1506", scope: "STATE", states: ["CA"], popularityScore: 80, tags: ["health", "marketplace"] },

  // ── Florida ──
  { name: "Florida Power & Light Company", slug: "fpl", category: "UTILITY_ELECTRIC", description: "Florida electric start, stop, move, deposit, and customer account support; confirm service availability by address", website: "https://www.fpl.com/landing/service-order.html", phone: "1-800-468-8243", scope: "STATE", states: ["FL"], popularityScore: 92, tags: ["electric", "utility", "fpl", "start-stop-service", "address-check"] },
  { name: "Duke Energy Florida", slug: "duke-fl", category: "UTILITY_ELECTRIC", description: "Florida electric start, stop, move, and customer account support; confirm service availability by address", website: "https://www.duke-energy.com/start-stop-move/landing", phone: "1-800-700-8744", scope: "STATE", states: ["FL"], popularityScore: 78, tags: ["electric", "utility", "duke-energy", "start-stop-service", "address-check"] },
  { name: "SunPass", slug: "sunpass", category: "TRANSPORTATION_TOLL", description: "Florida prepaid toll account for transponder, vehicle, payment, invoice, rental vehicle, and mailing details", website: "https://www.sunpass.com/", phone: "1-888-865-5352", scope: "STATE", states: ["FL"], popularityScore: 90, tags: ["toll", "transponder", "pay-by-plate", "driving", "florida"] },
  { name: "Florida Blue", slug: "florida-blue", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Florida", website: "https://www.floridablue.com", phone: "1-800-352-2583", scope: "STATE", states: ["FL"], popularityScore: 85, tags: ["health"] },
  { name: "Publix", slug: "publix", category: "SHOPPING_RETAIL", description: "Employee-owned supermarket chain", website: "https://www.publix.com", scope: "STATE", states: ["FL", "GA", "AL", "SC", "NC", "TN", "VA"], popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "Orlando Utilities Commission", slug: "ouc", category: "UTILITY_ELECTRIC", description: "OUC electric and water start, stop, move, and account support for Orlando, St. Cloud, and nearby service areas; confirm by address", website: "https://www.ouc.com/account/start-stop-move/", phone: "1-407-423-9018", scope: "STATE", states: ["FL"], zipCodes: ["327", "328", "347"], popularityScore: 76, tags: ["electric", "water", "utility", "orlando", "st-cloud", "address-check"] },
  { name: "JEA", slug: "jea", category: "UTILITY_ELECTRIC", description: "Northeast Florida electric, water, sewer, add, move, stop, and customer account support; confirm service availability by address", website: "https://www.jea.com/my_account/add%2C_move%2C_or_stop_service/", phone: "1-904-665-6000", scope: "STATE", states: ["FL"], zipCodes: ["320", "322"], popularityScore: 74, tags: ["electric", "water", "sewer", "utility", "jacksonville", "address-check"] },
  { name: "City of Tampa Utilities", slug: "tampa-water", category: "UTILITY_WATER", description: "City of Tampa water, wastewater, solid waste, utility start, transfer, stop, and account support", website: "https://www.tampa.gov/service/utility-service-starttransferstop-service", phone: "1-813-274-8811", scope: "STATE", states: ["FL"], zipCodes: FL_TAMPA_CITY_ZIPS, popularityScore: 72, tags: ["water", "wastewater", "solid-waste", "utility", "tampa", "address-check"] },
  { name: "Miami-Dade Water and Sewer Department", slug: "miami-water", category: "UTILITY_WATER", description: "Miami-Dade water and sewer start, stop, transfer, account, and billing support; confirm service availability by address", website: "https://www.miamidade.gov/global/water/my-account.page", phone: "1-305-665-7477", scope: "STATE", states: ["FL"], zipCodes: ["330", "331", "332"], popularityScore: 76, tags: ["water", "sewer", "utility", "miami-dade", "address-check"] },
  { name: "Peoples Gas Florida", slug: "teco-gas", category: "UTILITY_GAS", description: "Florida natural gas start, transfer, stop, availability-check, and account support; confirm service availability by address", website: "https://www.peoplesgas.com/residential/start-service/", phone: "1-877-832-6747", scope: "STATE", states: ["FL"], zipCodes: ["320", "321", "322", "323", "324", "325", "326", "327", "328", "330", "331", "332", "333", "334", "335", "336", "337", "338", "339", "342", "344", "346", "347", "349"], popularityScore: 80, tags: ["gas", "utility", "peoples-gas", "teco", "address-check"] },
  { name: "Miami-Dade Transit", slug: "miami-transit", category: "TRANSPORTATION_TRANSIT", description: "Metro, bus, and paratransit in Miami", website: "https://www.miamidade.gov/transit", phone: "1-305-891-3131", scope: "STATE", states: ["FL"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "Lynx", slug: "lynx", category: "TRANSPORTATION_TRANSIT", description: "Central Florida public transit", website: "https://www.golynx.com", phone: "1-407-841-8240", scope: "STATE", states: ["FL"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Pennsylvania ──
  { name: "PECO Energy", slug: "peco", category: "UTILITY_ELECTRIC", description: "Southeastern Pennsylvania electric and gas utility account support; confirm service availability by address", website: "https://secure.peco.com/CustomerServices/service/landing", phone: "1-800-494-4000", scope: "STATE", states: ["PA"], popularityScore: 88, tags: ["electric", "gas", "utility", "southeastern-pa", "address-check"] },
  { name: "PPL Electric Utilities", slug: "ppl", category: "UTILITY_ELECTRIC", description: "Central and eastern Pennsylvania electric utility account support; confirm service availability by address", website: "https://pplelectric.com/site/My-Account/Start-Stop-Move-Service", phone: "1-800-342-5775", scope: "STATE", states: ["PA"], popularityScore: 82, tags: ["electric", "utility", "central-pa", "eastern-pa", "address-check"] },
  { name: "Pennsylvania Turnpike Commission E-ZPass", slug: "pa-ezpass", category: "TRANSPORTATION_TOLL", description: "Pennsylvania Turnpike E-ZPass and Toll By Plate account support", website: "https://www.paturnpike.com/e-zpass/personal-account", phone: "1-877-736-6727", scope: "STATE", states: ["PA"], popularityScore: 85, tags: ["toll", "car", "ezpass", "toll-by-plate", "driving"] },
  { name: "SEPTA", slug: "septa", category: "TRANSPORTATION_TRANSIT", description: "Southeastern PA Transportation", website: "https://www.septa.org", phone: "1-215-580-7800", scope: "STATE", states: ["PA"], popularityScore: 80, tags: ["transit", "bus", "train"] },
  { name: "Pennie (PA Marketplace)", slug: "pennie-pa", category: "FINANCIAL_INSURANCE_HEALTH", description: "PA Health Insurance Marketplace", website: "https://pennie.com", scope: "STATE", states: ["PA"], popularityScore: 75, tags: ["health", "marketplace"] },
  { name: "Philadelphia Water Department", slug: "philly-water", category: "UTILITY_WATER", description: "Philadelphia water and sewer customer account setup and billing support", website: "https://www.phila.gov/services/water-gas-utilities/become-a-water-customer/", phone: "1-215-685-6300", scope: "STATE", states: ["PA"], popularityScore: 78, tags: ["water", "sewer", "philadelphia"] },
  { name: "Pittsburgh Water & Sewer", slug: "pittsburgh-water", category: "UTILITY_WATER", description: "Water for Pittsburgh", website: "https://pittsburghwater.gov", phone: "1-412-255-2420", scope: "STATE", states: ["PA"], popularityScore: 72, tags: ["water"] },
  { name: "UGI Utilities", slug: "ugi", category: "UTILITY_GAS", description: "Pennsylvania natural gas and limited electric utility account support; confirm service availability by address", website: "https://www.ugi.com/start-stop-transfer-service/", phone: "1-800-276-2722", scope: "STATE", states: ["PA"], popularityScore: 76, tags: ["gas", "electric", "utility", "address-check"] },
  { name: "Pittsburgh Regional Transit", slug: "pittsburgh-port-auth", category: "TRANSPORTATION_TRANSIT", description: "Pittsburgh and Allegheny County bus, light rail, and incline transit service", website: "https://www.rideprt.org", phone: "1-412-442-2000", scope: "STATE", states: ["PA"], zipCodes: ["150", "151", "152"], popularityScore: 72, tags: ["transit", "bus", "light-rail", "pittsburgh", "allegheny-county"] },

  // ── Illinois ──
  { name: "ComEd", slug: "comed", category: "UTILITY_ELECTRIC", description: "Commonwealth Edison", website: "https://www.comed.com", phone: "1-800-334-7661", scope: "STATE", states: ["IL"], popularityScore: 92, tags: ["electric"] },
  { name: "Peoples Gas", slug: "peoples-gas", category: "UTILITY_GAS", description: "Natural gas for Chicago", website: "https://www.peoplesgasdelivery.com", phone: "1-866-556-6001", scope: "STATE", states: ["IL"], popularityScore: 80, tags: ["gas"] },
  { name: "I-PASS", slug: "ipass", category: "TRANSPORTATION_TOLL", description: "Illinois toll pass", website: "https://www.getipass.com", scope: "STATE", states: ["IL"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "CTA", slug: "cta", category: "TRANSPORTATION_TRANSIT", description: "Chicago Transit Authority", website: "https://www.transitchicago.com", scope: "STATE", states: ["IL"], popularityScore: 90, tags: ["transit", "bus", "train"] },
  { name: "Chicago Water Department", slug: "chicago-water", category: "UTILITY_WATER", description: "Water for Chicago", website: "https://www.chicago.gov/water", phone: "1-312-744-4428", scope: "STATE", states: ["IL"], popularityScore: 80, tags: ["water"] },
  { name: "Illinois American Water", slug: "il-american-water", category: "UTILITY_WATER", description: "Water for Illinois", website: "https://www.amwater.com/ilaw", phone: "1-800-422-2782", scope: "STATE", states: ["IL"], popularityScore: 72, tags: ["water"] },
  { name: "Nicor Gas", slug: "nicor", category: "UTILITY_GAS", description: "Natural gas for Chicago suburbs", website: "https://www.nicorgas.com", phone: "1-888-642-6748", scope: "STATE", states: ["IL"], popularityScore: 75, tags: ["gas"] },
  { name: "Metra", slug: "metra", category: "TRANSPORTATION_TRANSIT", description: "Chicago commuter rail", website: "https://www.metrarail.com", phone: "1-312-322-6777", scope: "STATE", states: ["IL"], popularityScore: 78, tags: ["transit", "train"] },
  { name: "Pace Bus", slug: "pace", category: "TRANSPORTATION_TRANSIT", description: "Suburban Chicago bus service", website: "https://www.pacebus.com", phone: "1-847-364-7223", scope: "STATE", states: ["IL"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Georgia ──
  { name: "Georgia Power", slug: "georgia-power", category: "UTILITY_ELECTRIC", description: "Georgia electric start, stop, transfer, and account support; confirm service availability by address", website: "https://www.georgiapower.com/residential/manage-your-account/start-stop-move.html", phone: "1-888-660-5890", scope: "STATE", states: ["GA"], popularityScore: 92, tags: ["electric", "utility", "start-stop-service", "address-check"] },
  { name: "Peach Pass", slug: "peach-pass", category: "TRANSPORTATION_TOLL", description: "Georgia Express Lanes toll account, transponder, vehicle, payment, and account management surface", website: "https://peachpass.com/", scope: "STATE", states: ["GA"], popularityScore: 80, tags: ["toll", "transponder", "express-lanes", "driving", "georgia"] },
  { name: "MARTA", slug: "marta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Atlanta Rapid Transit", website: "https://www.itsmarta.com", scope: "STATE", states: ["GA"], popularityScore: 78, tags: ["transit", "bus", "train"] },
  { name: "City of Atlanta Department of Watershed Management", slug: "atlanta-water", category: "UTILITY_WATER", description: "City of Atlanta water and sewer start, stop, billing, and account support; confirm service availability by address", website: "https://atlantawatershed.org/start-my-service/", phone: "1-404-546-0311", scope: "STATE", states: ["GA"], popularityScore: 75, tags: ["water", "sewer", "utility", "atlanta", "address-check"] },
  { name: "Georgia Natural Gas", slug: "gng", category: "UTILITY_GAS", description: "Georgia retail natural gas marketer mover enrollment, transfer, plan, and account support; confirm availability by address", website: "https://gng.com/shop-plans/movers", phone: "1-770-850-6200", scope: "STATE", states: ["GA"], popularityScore: 72, tags: ["gas", "retail-marketer", "atlanta-gas-light", "address-check"] },

  // ── Ohio ──
  { name: "Ohio Turnpike E-ZPass", slug: "ohio-turnpike-ezpass", category: "TRANSPORTATION_TOLL", description: "Ohio Turnpike E-ZPass account, transponder, vehicle, payment, and account-management support", website: "https://www.ezpassoh.com/", phone: "1-440-971-2222", scope: "STATE", states: ["OH"], zipCodes: OH_TURNPIKE_ZIPS, popularityScore: 84, tags: ["toll", "ezpass", "transponder", "ohio-turnpike", "driving"] },
  { name: "FirstEnergy Ohio Utilities", slug: "ohio-edison", category: "UTILITY_ELECTRIC", description: "Ohio Edison, The Illuminating Company, and Toledo Edison electric start, stop, move, and account support; confirm service availability by address", website: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html", phone: "1-888-544-4877", scope: "STATE", states: ["OH"], zipCodes: OH_FIRSTENERGY_ZIPS, popularityScore: 82, tags: ["electric", "utility", "firstenergy", "ohio-edison", "illuminating-company", "toledo-edison", "address-check"] },
  { name: "AEP Ohio", slug: "aep-ohio", category: "UTILITY_ELECTRIC", description: "Ohio electric start, stop, transfer, and account support; confirm service availability by address", website: "https://www.aepohio.com/account/service/start-stop-transfer", phone: "1-800-672-2231", scope: "STATE", states: ["OH"], zipCodes: OH_AEP_ZIPS, popularityScore: 80, tags: ["electric", "utility", "aep", "address-check"] },
  { name: "Duke Energy Ohio", slug: "duke-oh", category: "UTILITY_ELECTRIC", description: "Southwestern Ohio electric and natural gas start, stop, move, and account support; confirm service availability by address", website: "https://www.duke-energy.com/start-stop-move/landing", phone: "1-800-544-6900", scope: "STATE", states: ["OH"], zipCodes: OH_DUKE_ZIPS, popularityScore: 78, tags: ["electric", "gas", "utility", "duke-energy", "cincinnati", "address-check"] },
  { name: "AES Ohio", slug: "aes-ohio", category: "UTILITY_ELECTRIC", description: "Dayton and west-central Ohio electric start, stop, transfer, and account support; formerly Dayton Power & Light", website: "https://www.aes-ohio.com/moving", phone: "1-800-433-8500", scope: "STATE", states: ["OH"], zipCodes: OH_AES_ZIPS, popularityScore: 76, tags: ["electric", "utility", "aes", "dayton-power-light", "address-check"] },
  { name: "Cleveland Public Power", slug: "cleveland-public-power", category: "UTILITY_ELECTRIC", description: "City of Cleveland municipal electric start, transfer, and account support; confirm service availability by address", website: "https://www.cpp.org/Residential/Start-Service", phone: "1-216-664-3922", scope: "STATE", states: ["OH"], zipCodes: ["441"], popularityScore: 68, tags: ["electric", "utility", "municipal", "cleveland", "address-check"] },
  { name: "Columbia Gas of Ohio", slug: "columbia-gas-oh", category: "UTILITY_GAS", description: "Ohio natural gas start, stop, move, and account support; confirm service availability by address", website: "https://www.columbiagasohio.com/services/start-stop-or-move-service", phone: "1-800-344-4077", scope: "STATE", states: ["OH"], zipCodes: OH_COLUMBIA_GAS_ZIPS, popularityScore: 80, tags: ["gas", "utility", "nisource", "address-check"] },
  { name: "Enbridge Gas Ohio", slug: "enbridge-gas-oh", category: "UTILITY_GAS", description: "Ohio natural gas start, stop, transfer, reconnect, and account support; formerly Dominion Energy Ohio gas", website: "https://www.enbridgegas.com/ohio/start-stop-service", phone: "1-800-362-7557", scope: "STATE", states: ["OH"], zipCodes: OH_ENBRIDGE_GAS_ZIPS, popularityScore: 78, tags: ["gas", "utility", "enbridge", "dominion-energy-ohio", "address-check"] },
  { name: "CenterPoint Energy Ohio", slug: "centerpoint-oh-gas", category: "UTILITY_GAS", description: "West-central Ohio natural gas start, stop, transfer, and account support; formerly Vectren Ohio, with National Fuel sale pending while customer service remains CenterPoint", website: "https://www.centerpointenergy.com/en-us/residential/customer-service/start-stop-transfer-service?sa=OH", phone: "1-800-227-1376", scope: "STATE", states: ["OH"], zipCodes: OH_CENTERPOINT_GAS_ZIPS, popularityScore: 72, tags: ["gas", "utility", "centerpoint", "vectren", "national-fuel-pending", "address-check"] },
  { name: "Cleveland Water Department", slug: "cleveland-water", category: "UTILITY_WATER", description: "Northeast Ohio water account, move, final bill, and service support; confirm service availability by address", website: "https://www.clevelandwater.com/customer-service/faqs", phone: "1-216-664-3060", scope: "STATE", states: ["OH"], zipCodes: OH_CLEVELAND_REGION_ZIPS, popularityScore: 74, tags: ["water", "utility", "cleveland", "northeast-ohio", "address-check"] },
  { name: "City of Columbus Water & Power", slug: "columbus-water", category: "UTILITY_WATER", description: "Columbus water, sewer, power, start-new-service, account, and move support; confirm service availability by address", website: "https://www.columbus.gov/Services/Columbus-Water-Power/Start-New-Utility-Service", phone: "1-614-645-8276", scope: "STATE", states: ["OH"], zipCodes: OH_COLUMBUS_REGION_ZIPS, popularityScore: 76, tags: ["water", "sewer", "power", "utility", "columbus", "address-check"] },
  { name: "Greater Cincinnati Water Works", slug: "cincy-water", category: "UTILITY_WATER", description: "Cincinnati-region water moving, selling-property, billing, and account support; confirm service availability by address", website: "https://www.cincinnati-oh.gov/water/moving-or-selling-your-property1/", phone: "1-513-591-7700", scope: "STATE", states: ["OH"], zipCodes: OH_CINCINNATI_REGION_ZIPS, popularityScore: 72, tags: ["water", "utility", "cincinnati", "hamilton-county", "address-check"] },
  { name: "City of Toledo Department of Public Utilities", slug: "toledo-public-utilities", category: "UTILITY_WATER", description: "Toledo water new-service, cancel-service, account, and utility billing support; confirm service availability by address", website: "https://toledo.oh.gov/residents/water/customer-service/turn-on-new-water-service", phone: "1-419-245-1800", scope: "STATE", states: ["OH"], zipCodes: OH_TOLEDO_REGION_ZIPS, popularityScore: 66, tags: ["water", "utility", "toledo", "address-check"] },
  { name: "Northeast Ohio Regional Sewer District", slug: "neorsd", category: "UTILITY_SEWER", description: "Greater Cleveland regional sewer and stormwater billing, account, and service-routing support", website: "https://www.neorsd.org/customers-service-page/bill-payment-option/", phone: "1-216-881-8247", scope: "STATE", states: ["OH"], zipCodes: OH_CLEVELAND_REGION_ZIPS, popularityScore: 68, tags: ["sewer", "stormwater", "utility", "cleveland", "address-check"] },
  { name: "Metropolitan Sewer District of Greater Cincinnati", slug: "msd-greater-cincinnati", category: "UTILITY_SEWER", description: "Greater Cincinnati sewer billing, account, sewer issue, and customer support; confirm service availability by address", website: "https://msdgc.org/", phone: "1-513-244-1300", scope: "STATE", states: ["OH"], zipCodes: OH_CINCINNATI_REGION_ZIPS, popularityScore: 66, tags: ["sewer", "utility", "cincinnati", "hamilton-county", "address-check"] },
  { name: "Rumpke Waste & Recycling Ohio", slug: "rumpke-oh", category: "UTILITY_TRASH", description: "Ohio residential trash and recycling service requests, availability, carts, and collection support; confirm by address", website: "https://www.rumpke.com/about-us/service-areas/oh", phone: "1-800-828-8171", scope: "STATE", states: ["OH"], zipCodes: OH_RUMPKE_ZIPS, popularityScore: 70, tags: ["trash", "recycling", "waste", "rumpke", "address-check"] },
  { name: "City of Columbus Division of Refuse Collection", slug: "columbus-refuse", category: "UTILITY_TRASH", description: "Columbus trash, recycling, bulk, yard-waste, collection-day, and 311 service support", website: "https://www.columbus.gov/Services/Trash-Recycling-Bulk-Collection", phone: "1-614-645-3111", scope: "STATE", states: ["OH"], zipCodes: OH_COLUMBUS_REGION_ZIPS, popularityScore: 68, tags: ["trash", "recycling", "bulk", "yard-waste", "columbus", "address-check"] },
  { name: "COTA", slug: "cota", category: "TRANSPORTATION_TRANSIT", description: "Central Ohio Transit Authority", website: "https://www.cota.com", phone: "1-614-228-1776", scope: "STATE", states: ["OH"], popularityScore: 68, tags: ["transit", "bus"] },
  { name: "RTA Cleveland", slug: "rta-cleveland", category: "TRANSPORTATION_TRANSIT", description: "Greater Cleveland Regional Transit", website: "https://www.riderta.com", phone: "1-216-621-9500", scope: "STATE", states: ["OH"], popularityScore: 70, tags: ["transit", "bus", "train"] },

  // ── Massachusetts ──
  { name: "Eversource Energy", slug: "eversource", category: "UTILITY_ELECTRIC", description: "Massachusetts and Connecticut electric and natural gas utility account support; confirm service availability by address", website: "https://www.eversource.com/residential/services/start-stop-or-transfer-service", phone: "1-800-592-2000", scope: "STATE", states: ["MA", "CT"], popularityScore: 88, tags: ["electric", "gas", "utility", "massachusetts", "connecticut", "address-check"] },
  { name: "National Grid Massachusetts", slug: "national-grid-ma", category: "UTILITY_ELECTRIC", description: "Massachusetts electric and natural gas utility account support; confirm service availability by address", website: "https://www.nationalgridus.com/MA-Home/Start-or-Transfer-Service", phone: "1-800-322-3223", scope: "STATE", states: ["MA"], popularityScore: 84, tags: ["electric", "gas", "utility", "massachusetts", "address-check"] },
  { name: "MBTA", slug: "mbta", category: "TRANSPORTATION_TRANSIT", description: "Massachusetts Bay Transportation Authority", website: "https://www.mbta.com", scope: "STATE", states: ["MA"], popularityScore: 88, tags: ["transit", "bus", "train", "subway"] },
  { name: "MA Health Connector", slug: "ma-health-connector", category: "FINANCIAL_INSURANCE_HEALTH", description: "MA Health Insurance Marketplace", website: "https://www.mahealthconnector.org", scope: "STATE", states: ["MA"], popularityScore: 78, tags: ["health", "marketplace"] },

  // ── Washington ──
  { name: "Puget Sound Energy", slug: "pse-wa", category: "UTILITY_ELECTRIC", description: "Puget Sound-region electric and natural gas utility account support; confirm service availability by address", website: "https://www.pse.com/en/start-stop-move/start-stop-move", phone: "1-888-225-5773", scope: "STATE", states: ["WA"], popularityScore: 85, tags: ["electric", "gas", "utility", "puget-sound", "address-check"] },
  { name: "Seattle City Light", slug: "seattle-city-light", category: "UTILITY_ELECTRIC", description: "Seattle-area municipal electric utility start and stop service support", website: "https://www.seattle.gov/city-light/start-or-stop-service", phone: "1-206-684-3000", scope: "STATE", states: ["WA"], popularityScore: 80, tags: ["electric", "utility", "seattle", "address-check"] },
  { name: "Good To Go!", slug: "good-to-go", category: "TRANSPORTATION_TOLL", description: "Washington toll account and pass provider for tolled bridges, tunnels, and express lanes", website: "https://www.mygoodtogo.com", phone: "1-866-936-8246", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["toll", "pass", "license-plate", "washington"] },
  { name: "WA Healthplanfinder", slug: "wa-healthplanfinder", category: "FINANCIAL_INSURANCE_HEALTH", description: "WA Health Insurance Marketplace", website: "https://www.wahealthplanfinder.org", scope: "STATE", states: ["WA"], popularityScore: 75, tags: ["health", "marketplace"] },

  // ── Colorado ──
  { name: "Xcel Energy Colorado", slug: "xcel-energy", category: "UTILITY_ELECTRIC", description: "Colorado electric and natural gas start, stop, transfer, and account support; confirm service availability by address", website: "https://co.my.xcelenergy.com/s/moving", phone: "1-800-895-4999", scope: "STATE", states: ["CO"], zipCodes: CO_XCEL_ZIPS, popularityScore: 85, tags: ["electric", "gas", "utility", "colorado", "address-check"] },
  { name: "ExpressToll", slug: "expresstoll", category: "TRANSPORTATION_TOLL", description: "Colorado toll account for E-470, Northwest Parkway, and CDOT Express Lanes", website: "https://www.expresstoll.com", phone: "1-888-946-3470", scope: "STATE", states: ["CO"], zipCodes: CO_EXPRESSTOLL_ZIPS, popularityScore: 80, tags: ["toll", "car", "transponder", "express-lanes", "denver"] },
  { name: "RTD", slug: "rtd", category: "TRANSPORTATION_TRANSIT", description: "Regional Transportation District Denver", website: "https://www.rtd-denver.com", scope: "STATE", states: ["CO"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "Connect for Health CO", slug: "connect-health-co", category: "FINANCIAL_INSURANCE_HEALTH", description: "CO Health Insurance Marketplace", website: "https://connectforhealthco.com", scope: "STATE", states: ["CO"], popularityScore: 72, tags: ["health", "marketplace"] },
  { name: "Denver Water", slug: "denver-water", category: "UTILITY_WATER", description: "Denver-area water start, stop, final bill, and transfer-of-service support; confirm service availability by address", website: "https://www.denverwater.org/residential/services-and-information/start-or-stop-service", phone: "1-303-893-2444", scope: "STATE", states: ["CO"], zipCodes: CO_DENVER_WATER_ZIPS, popularityScore: 80, tags: ["water", "utility", "denver", "address-check"] },

  // ── Arizona ──
  { name: "Arizona Public Service", slug: "aps-az", category: "UTILITY_ELECTRIC", description: "Arizona Public Service electric start, stop, move, and account support; confirm service availability by address", website: "https://www.aps.com/en/Residential/Account/Start-Stop-and-Move-Service", phone: "1-602-371-7171", scope: "STATE", states: ["AZ"], zipCodes: AZ_APS_ZIPS, popularityScore: 90, tags: ["electric", "utility", "aps", "address-check"] },
  { name: "Salt River Project", slug: "srp-az", category: "UTILITY_ELECTRIC", description: "Central Arizona electric and water start, stop, transfer, and account support; confirm service availability by address", website: "https://myaccount.srpnet.com/power/residentialelectric", scope: "STATE", states: ["AZ"], zipCodes: AZ_SRP_ZIPS, popularityScore: 85, tags: ["electric", "water", "utility", "phoenix-metro", "address-check"] },
  { name: "City of Phoenix Water Services", slug: "phoenix-water", category: "UTILITY_WATER", description: "City of Phoenix water, sewer, trash, and city services billing start, stop, and transfer support", website: "https://www.phoenix.gov/residents/water-sewer.html", scope: "STATE", states: ["AZ"], zipCodes: AZ_PHOENIX_CITY_ZIPS, popularityScore: 78, tags: ["water", "sewer", "trash", "utility", "phoenix", "address-check"] },
  { name: "Tucson Water", slug: "tucson-water", category: "UTILITY_WATER", description: "Tucson-area water start, stop, billing, and account support; confirm service availability by address", website: "https://www.tucsonaz.gov/Departments/Water", phone: "1-520-791-3242", scope: "STATE", states: ["AZ"], zipCodes: AZ_TUCSON_ZIPS, popularityScore: 72, tags: ["water", "utility", "tucson", "address-check"] },
  { name: "City of Mesa Utilities", slug: "mesa-utilities", category: "UTILITY_WATER", description: "Mesa municipal electric, natural gas, water, wastewater, trash, and recycling start or cancel service support", website: "https://www.mesaaz.gov/Utilities", phone: "1-480-644-2221", scope: "STATE", states: ["AZ"], zipCodes: ["852"], popularityScore: 68, tags: ["water", "electric", "gas", "trash", "utility", "mesa", "address-check"] },
  { name: "Southwest Gas", slug: "southwest-gas", category: "UTILITY_GAS", description: "Arizona and Nevada natural gas start, stop, move, and account support; confirm service availability by address", website: "https://www.swgas.com/en/residential", phone: "1-877-860-6020", scope: "STATE", states: ["AZ", "NV"], zipCodes: AZ_NV_SOUTHWEST_GAS_ZIPS, popularityScore: 75, tags: ["gas", "utility", "arizona", "nevada", "address-check"] },
  { name: "UniSource Energy Services Gas", slug: "unisource-gas-az", category: "UTILITY_GAS", description: "Arizona UniSource natural gas start, stop, transfer, and account support; confirm service availability by address", website: "https://www.uesaz.com/im-moving/", scope: "STATE", states: ["AZ"], zipCodes: AZ_UNISOURCE_ZIPS, popularityScore: 72, tags: ["gas", "utility", "unisource", "address-check"] },
  { name: "EPCOR Water Arizona", slug: "epcor-water-az", category: "UTILITY_WATER", description: "Arizona private water and wastewater start, stop, account, and service support for non-contiguous districts; confirm by address", website: "https://www.epcor.com/us/en/az/account/start-service.html", scope: "STATE", states: ["AZ"], zipCodes: AZ_PRIVATE_WATER_ZIPS, popularityScore: 74, tags: ["water", "wastewater", "utility", "epcor", "address-check"] },
  { name: "Arizona Water Company", slug: "arizona-water-company", category: "UTILITY_WATER", description: "Arizona private water utility account, start, stop, and address update support across multiple systems; confirm by address", website: "https://www.azwater.com/", scope: "STATE", states: ["AZ"], zipCodes: AZ_PRIVATE_WATER_ZIPS, popularityScore: 72, tags: ["water", "utility", "address-check"] },
  { name: "Liberty Utilities Arizona Water and Wastewater", slug: "liberty-utilities-az-water", category: "UTILITY_WATER", description: "Arizona Liberty Utilities water and wastewater transfer, account, and customer-service support for selected communities; confirm by address", website: "https://arizona.libertyutilities.com/rio-rico/commercial/new-services/water-service-transfer.html", scope: "STATE", states: ["AZ"], zipCodes: AZ_PRIVATE_WATER_ZIPS, popularityScore: 68, tags: ["water", "wastewater", "utility", "liberty", "address-check"] },
  { name: "Trico Electric Cooperative", slug: "trico-electric", category: "UTILITY_ELECTRIC", description: "Tucson-area cooperative electric start, stop, transfer, and account support; confirm service by address", website: "https://trico.coop/start-stop-transfer-service/", scope: "STATE", states: ["AZ"], zipCodes: AZ_TRICO_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "tucson", "address-check"] },
  { name: "Mohave Electric Cooperative", slug: "mohave-electric", category: "UTILITY_ELECTRIC", description: "Northwest Arizona cooperative electric application and account setup support; confirm service by address", website: "https://www.mohaveelectric.com/member-service/apply-for-service/", scope: "STATE", states: ["AZ"], zipCodes: AZ_MOHAVE_ELECTRIC_ZIPS, popularityScore: 68, tags: ["electric", "cooperative", "mohave", "address-check"] },
  { name: "Sulphur Springs Valley Electric Cooperative", slug: "ssvec", category: "UTILITY_ELECTRIC", description: "Southeastern Arizona cooperative electric new-service and account support; confirm service by address", website: "https://www.ssvec.org/services/new-service.php", scope: "STATE", states: ["AZ"], zipCodes: AZ_SSVEC_ZIPS, popularityScore: 68, tags: ["electric", "cooperative", "southeast-arizona", "address-check"] },

  // ── Virginia / DC / Maryland ──
  { name: "Dominion Energy Virginia", slug: "dominion", category: "UTILITY_ELECTRIC", description: "Virginia electric start, stop, move, and account support; confirm service availability by address", website: "https://www.dominionenergy.com/en/Virginia/Start-Stop-Service", phone: "1-866-366-4357", scope: "STATE", states: ["VA"], popularityScore: 88, tags: ["electric", "utility", "virginia", "address-check"] },
  { name: "WMATA (Metro)", slug: "wmata", category: "TRANSPORTATION_TRANSIT", description: "Washington Metropolitan Area Transit", website: "https://www.wmata.com", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 85, tags: ["transit", "subway", "bus"] },
  { name: "Baltimore Gas & Electric", slug: "bge", category: "UTILITY_ELECTRIC", description: "Central Maryland electric and natural gas start, move, stop, and account support; confirm service availability by address", website: "https://secure.bge.com/CustomerServices/", phone: "1-800-685-0123", scope: "STATE", states: ["MD"], popularityScore: 90, tags: ["electric", "gas", "utility", "baltimore", "address-check"] },
  { name: "Pepco", slug: "pepco", category: "UTILITY_ELECTRIC", description: "Washington DC and Maryland suburban electric start, stop, move, and account support; confirm service availability by address", website: "https://www.pepco.com/MyAccount/MyService/Pages/StartStopMove.aspx", phone: "1-202-833-7500", scope: "STATE", states: ["DC", "MD"], popularityScore: 88, tags: ["electric", "utility", "dc", "maryland", "address-check"] },
  { name: "DC Water", slug: "dc-water", category: "UTILITY_WATER", description: "Water for Washington DC", website: "https://www.dcwater.com", phone: "1-202-354-3600", scope: "STATE", states: ["DC"], popularityScore: 85, tags: ["water"] },
  { name: "CareFirst BCBS", slug: "carefirst", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield for MD/DC/VA", website: "https://www.carefirst.com", scope: "STATE", states: ["MD", "DC", "VA"], popularityScore: 85, tags: ["health"] },
  { name: "Virginia American Water", slug: "va-american-water", category: "UTILITY_WATER", description: "Virginia water new-customer and account support; confirm service availability by address", website: "https://amwater.com/vaaw/customer-service-billing/for-new-customers", phone: "1-800-452-6863", scope: "STATE", states: ["VA"], zipCodes: VA_AMERICAN_WATER_ZIPS, popularityScore: 72, tags: ["water", "utility", "virginia", "address-check"] },
  { name: "Fairfax Water", slug: "fairfax-water", category: "UTILITY_WATER", description: "Northern Virginia water start, stop, and account support; confirm service availability by address", website: "https://www.fairfaxwater.org/start-service", phone: "1-703-698-5613", scope: "STATE", states: ["VA"], zipCodes: VA_FAIRFAX_WATER_ZIPS, popularityScore: 70, tags: ["water", "utility", "fairfax", "northern-virginia", "address-check"] },
  { name: "Washington Gas", slug: "washington-gas", category: "UTILITY_GAS", description: "Natural gas start, stop, and account support for DC, suburban Maryland, and Northern Virginia; confirm service availability by address", website: "https://www.washingtongas.com/services/current-customers/available-services/start-and-stop-service", phone: "1-844-927-4427", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 78, tags: ["gas", "utility", "dc", "maryland", "northern-virginia", "address-check"] },
  { name: "MD Health Connection", slug: "md-health-connection", category: "FINANCIAL_INSURANCE_HEALTH", description: "MD Health Insurance Marketplace", website: "https://www.marylandhealthconnection.gov", scope: "STATE", states: ["MD"], popularityScore: 75, tags: ["health", "marketplace"] },

  // ── Michigan ──
  { name: "DTE Energy", slug: "dte", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Michigan", website: "https://www.dteenergy.com", phone: "1-800-477-4747", scope: "STATE", states: ["MI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Consumers Energy", slug: "consumers-energy", category: "UTILITY_GAS", description: "Gas and electric for MI", website: "https://www.consumersenergy.com", phone: "1-800-477-5050", scope: "STATE", states: ["MI"], popularityScore: 82, tags: ["gas", "electric"] },

  // ── North Carolina ──
  { name: "Duke Energy North Carolina", slug: "duke-nc", category: "UTILITY_ELECTRIC", description: "North Carolina Duke Energy electric start, stop, move, and account support across Duke Energy Carolinas and Duke Energy Progress territories; confirm service availability by address", website: "https://www.duke-energy.com/start-stop-move/landing", phone: "1-800-777-9898", scope: "STATE", states: ["NC"], zipCodes: NC_DUKE_PREFILTER_ZIPS, popularityScore: 90, tags: ["electric", "utility", "duke-energy-carolinas", "duke-energy-progress", "address-check"] },
  { name: "NC Quick Pass", slug: "nc-quick-pass", category: "TRANSPORTATION_TOLL", description: "North Carolina toll account, transponder, invoice, vehicle, and payment management for NC toll facilities", website: "https://www.ncquickpass.com/open-account/", phone: "1-877-769-7277", scope: "STATE", states: ["NC"], zipCodes: NC_QUICK_PASS_ZIPS, popularityScore: 82, tags: ["toll", "transponder", "driving", "north-carolina-turnpike"] },
  { name: "Dominion Energy North Carolina", slug: "dominion-energy-nc", category: "UTILITY_ELECTRIC", description: "Northeastern North Carolina electric start, stop, transfer, reconnect, and account support; confirm service availability by address", website: "https://www.dominionenergy.com/en/North-Carolina/Start-Stop-Service", phone: "1-866-366-4357", scope: "STATE", states: ["NC"], zipCodes: NC_DOMINION_ELECTRIC_ZIPS, popularityScore: 78, tags: ["electric", "utility", "northeastern-north-carolina", "address-check"] },
  { name: "EnergyUnited", slug: "energyunited", category: "UTILITY_ELECTRIC", description: "North Carolina electric cooperative member service, account, and start-service support; confirm service availability by address", website: "https://www.energyunited.com/member-guide/", phone: "1-800-522-3793", scope: "STATE", states: ["NC"], zipCodes: NC_ENERGYUNITED_ZIPS, popularityScore: 72, tags: ["electric", "cooperative", "utility", "address-check"] },
  { name: "Blue Ridge Energy", slug: "blue-ridge-energy", category: "UTILITY_ELECTRIC", description: "Northwestern North Carolina electric cooperative apply-for-service and member account support; confirm service availability by address", website: "https://www.blueridgeenergy.com/residential/apply-for-service", phone: "1-800-451-5474", scope: "STATE", states: ["NC"], zipCodes: NC_BLUE_RIDGE_ENERGY_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "utility", "address-check"] },
  { name: "Brunswick Electric Membership Corporation", slug: "brunswick-electric", category: "UTILITY_ELECTRIC", description: "Southeastern North Carolina electric cooperative account transfer, new service, and member support; confirm service availability by address", website: "https://www.bemc.org/", phone: "1-800-842-5871", scope: "STATE", states: ["NC"], zipCodes: NC_BRUNSWICK_ELECTRIC_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "utility", "brunswick", "address-check"] },
  { name: "Piedmont Natural Gas", slug: "piedmont-carolinas", category: "UTILITY_GAS", description: "Natural gas start, stop, move, and account support for North Carolina and South Carolina service areas; confirm availability by address", website: "https://www.piedmontng.com/home/start-stop-or-move", phone: "1-800-752-7504", scope: "STATE", states: ["NC", "SC"], zipCodes: CAROLINAS_PIEDMONT_GAS_ZIPS, popularityScore: 84, tags: ["gas", "utility", "carolinas", "address-check"] },
  { name: "Enbridge Gas North Carolina", slug: "psnc", category: "UTILITY_GAS", description: "North Carolina natural gas start, stop, transfer, and account support; formerly PSNC and Dominion Energy North Carolina gas", website: "https://www.enbridgegas.com/north-carolina/start-stop-service", phone: "1-877-776-2427", scope: "STATE", states: ["NC"], zipCodes: NC_ENBRIDGE_GAS_ZIPS, popularityScore: 82, tags: ["gas", "utility", "enbridge", "psnc", "dominion-energy-nc-gas", "address-check"] },
  { name: "Frontier Natural Gas Company", slug: "frontier-natural-gas", category: "UTILITY_GAS", description: "North Carolina natural gas availability and sign-up support for selected western and foothills service areas; confirm service by address", website: "https://www.frontiernaturalgas.com/sign-up-for-service/", phone: "1-888-806-7015", scope: "STATE", states: ["NC"], zipCodes: NC_FRONTIER_GAS_ZIPS, popularityScore: 64, tags: ["gas", "utility", "address-check"] },
  { name: "Charlotte Water", slug: "charlotte-water", category: "UTILITY_WATER", description: "Charlotte-area water and sewer move-in, move-out, account, and service support; confirm service availability by address", website: "https://www.charlottenc.gov/water/Customer-Care/Start-Stop-Service", phone: "1-704-336-7600", scope: "STATE", states: ["NC"], zipCodes: NC_CHARLOTTE_ZIPS, popularityScore: 80, tags: ["water", "sewer", "utility", "charlotte", "address-check"] },
  { name: "City of Charlotte Solid Waste Services", slug: "charlotte-solid-waste", category: "UTILITY_TRASH", description: "Charlotte garbage, recycling, yard waste, bulky item, cart, and collection support for resident moves", website: "https://www.charlottenc.gov/Services/Trash-and-Recycling", phone: "1-704-336-7600", scope: "STATE", states: ["NC"], zipCodes: NC_CHARLOTTE_ZIPS, popularityScore: 70, tags: ["trash", "recycling", "solid-waste", "charlotte", "address-check"] },
  { name: "Raleigh Water", slug: "raleigh-water", category: "UTILITY_WATER", description: "Raleigh-area water and sewer start, stop, transfer, account, and service support; confirm service availability by address", website: "https://raleighnc.gov/water-and-sewer/services/start-stop-or-transfer-utility-services", phone: "1-919-996-3245", scope: "STATE", states: ["NC"], zipCodes: NC_RALEIGH_SERVICE_ZIPS, popularityScore: 78, tags: ["water", "sewer", "utility", "raleigh", "address-check"] },
  { name: "City of Raleigh Solid Waste Services", slug: "raleigh-solid-waste", category: "UTILITY_TRASH", description: "Raleigh garbage, recycling, bulky pickup, cart, and collection support for resident moves", website: "https://raleighnc.gov/departments/solid-waste-services", phone: "1-919-996-3245", scope: "STATE", states: ["NC"], zipCodes: NC_RALEIGH_SERVICE_ZIPS, popularityScore: 68, tags: ["trash", "recycling", "solid-waste", "raleigh", "address-check"] },
  { name: "City of Durham Department of Water Management", slug: "durham-water", category: "UTILITY_WATER", description: "Durham water and sewer start, stop, transfer, account, and service support; confirm service availability by address", website: "https://www.durhamnc.gov/4097/Start-Stop-Transfer", phone: "1-919-560-1200", scope: "STATE", states: ["NC"], zipCodes: NC_DURHAM_ZIPS, popularityScore: 76, tags: ["water", "sewer", "utility", "durham", "address-check"] },
  { name: "City of Durham Solid Waste Management", slug: "durham-solid-waste", category: "UTILITY_TRASH", description: "Durham garbage, recycling, yard waste, bulky item, cart, and collection support for resident moves", website: "https://www.durhamnc.gov/832/Solid-Waste", phone: "1-919-560-1200", scope: "STATE", states: ["NC"], zipCodes: NC_DURHAM_ZIPS, popularityScore: 66, tags: ["trash", "recycling", "solid-waste", "durham", "address-check"] },
  { name: "Greensboro Water Resources", slug: "greensboro-water", category: "UTILITY_WATER", description: "Greensboro water and sewer customer service, account, and service availability support; confirm service by address", website: "https://www.greensboro-nc.gov/departments/water-resources/customer-service-for-residents-and-businesses", phone: "1-336-373-2489", scope: "STATE", states: ["NC"], zipCodes: NC_GREENSBORO_ZIPS, popularityScore: 72, tags: ["water", "sewer", "utility", "greensboro", "address-check"] },
  { name: "Winston-Salem/Forsyth County Utilities", slug: "winston-salem-forsyth-utilities", category: "UTILITY_WATER", description: "Winston-Salem and Forsyth County water, sewer, account, and start/stop/transfer service support; confirm service by address", website: "https://www.cityofws.org/1237/Start-Stop-or-Transfer-Service", phone: "1-336-727-8000", scope: "STATE", states: ["NC"], zipCodes: NC_WINSTON_SALEM_ZIPS, popularityScore: 72, tags: ["water", "sewer", "utility", "winston-salem", "forsyth-county", "address-check"] },
  { name: "Winston-Salem Solid Waste Collections", slug: "winston-salem-solid-waste", category: "UTILITY_TRASH", description: "Winston-Salem garbage, recycling, cart, collection-zone, and resident solid-waste service support", website: "https://www.cityofws.org/568/Solid-Waste-Collections", phone: "1-336-727-8000", scope: "STATE", states: ["NC"], zipCodes: NC_WINSTON_SALEM_ZIPS, popularityScore: 66, tags: ["trash", "recycling", "solid-waste", "winston-salem", "address-check"] },
  { name: "Orange Water and Sewer Authority", slug: "owasa", category: "UTILITY_WATER", description: "Carrboro and Chapel Hill water, sewer, reclaimed water, start, stop, and move service support; confirm by address", website: "https://www.owasa.org/start-stop-move/", phone: "1-919-968-4421", scope: "STATE", states: ["NC"], zipCodes: NC_OWASA_ZIPS, popularityScore: 70, tags: ["water", "sewer", "utility", "chapel-hill", "carrboro", "address-check"] },
  { name: "Aqua North Carolina", slug: "aqua-nc", category: "UTILITY_WATER", description: "North Carolina private water and wastewater start, stop, account, and service support for scattered communities; confirm by address", website: "https://www.aquawater.com/start-or-stop-service", phone: "1-877-987-2782", scope: "STATE", states: ["NC"], zipCodes: NC_PRIVATE_WATER_ZIPS, popularityScore: 70, tags: ["water", "wastewater", "utility", "aqua", "address-check"] },
  { name: "Carolina Water Service of North Carolina", slug: "carolina-water-nc", category: "UTILITY_WATER", description: "North Carolina private water and wastewater account, start, stop, and transfer support for scattered service communities; confirm by address", website: "https://www.mywater.us/north-carolina", phone: "1-800-525-7990", scope: "STATE", states: ["NC"], zipCodes: NC_PRIVATE_WATER_ZIPS, popularityScore: 68, tags: ["water", "wastewater", "utility", "mywater", "address-check"] },
  { name: "Old North State Water Company", slug: "old-north-state-water", category: "UTILITY_WATER", description: "North Carolina private water and wastewater start, stop, transfer, and customer-service support for scattered communities; confirm by address", website: "https://onswc.com/customer-service/", phone: "1-877-511-2911", scope: "STATE", states: ["NC"], zipCodes: NC_PRIVATE_WATER_ZIPS, popularityScore: 64, tags: ["water", "wastewater", "utility", "address-check"] },
  { name: "GoRaleigh", slug: "goraleigh", category: "TRANSPORTATION_TRANSIT", description: "Raleigh public transit", website: "https://goraleigh.org", phone: "1-919-485-7433", scope: "STATE", states: ["NC"], popularityScore: 65, tags: ["transit", "bus"] },
  { name: "GoTriangle", slug: "gotriangle", category: "TRANSPORTATION_TRANSIT", description: "Regional transit for Research Triangle", website: "https://gotriangle.org", phone: "1-919-549-9999", scope: "STATE", states: ["NC"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Alabama ──
  { name: "Alabama Power", slug: "alabama-power", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alabama", website: "https://www.alabamapower.com", phone: "1-800-245-2244", scope: "STATE", states: ["AL"], popularityScore: 92, tags: ["electric"] },
  { name: "Alagasco", slug: "alagasco", category: "UTILITY_GAS", description: "Alabama gas utility", website: "https://www.alagasco.com", phone: "1-800-292-4008", scope: "STATE", states: ["AL"], popularityScore: 78, tags: ["gas"] },
  { name: "Birmingham Water Works", slug: "bwwb", category: "UTILITY_WATER", description: "Water for Birmingham metro", website: "https://www.bwwb.org", phone: "1-205-244-4000", scope: "STATE", states: ["AL"], popularityScore: 70, tags: ["water"] },
  { name: "BCBS Alabama", slug: "bcbs-al", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Alabama", website: "https://www.bcbsal.org", phone: "1-800-292-8868", scope: "STATE", states: ["AL"], popularityScore: 85, tags: ["health"] },

  // ── Alaska ──
  { name: "Chugach Electric", slug: "chugach-electric", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alaska", website: "https://www.chugachelectric.com", phone: "1-907-563-7494", scope: "STATE", states: ["AK"], popularityScore: 85, tags: ["electric"] },
  { name: "GCI", slug: "gci-ak", category: "UTILITY_INTERNET", description: "Internet, wireless, and TV services in Alaska", website: "https://www.gci.com", scope: "STATE", states: ["AK"], popularityScore: 78, tags: ["internet", "phone", "cable"] },
  { name: "Anchorage Water & Wastewater Utility", slug: "anchorage-water", category: "UTILITY_WATER", description: "Municipal water and wastewater utility for Anchorage", website: "https://www.awwu.biz", scope: "STATE", states: ["AK"], popularityScore: 72, tags: ["water"] },
  { name: "Premera Blue Cross Alaska", slug: "premera-ak", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield coverage in Alaska", website: "https://www.premera.com", scope: "STATE", states: ["AK"], popularityScore: 82, tags: ["health"] },

  // ── Hawaii ──
  { name: "Hawaiian Electric Company", slug: "heco", category: "UTILITY_ELECTRIC", description: "Oahu electric utility account support; confirm service availability by address", website: "https://www.hawaiianelectric.com/customer-service/oahu-directory", phone: "1-808-548-7311", scope: "STATE", states: ["HI"], zipCodes: HAWAII_OAHU_ZIPS, popularityScore: 92, tags: ["electric", "utility", "oahu", "honolulu-county", "address-check"] },
  { name: "HMSA", slug: "hmsa", category: "FINANCIAL_INSURANCE_HEALTH", description: "Hawaii Medical Service Association", website: "https://www.hmsa.com", phone: "1-808-948-6111", scope: "STATE", states: ["HI"], popularityScore: 90, tags: ["health"] },
  { name: "Board of Water Supply, City and County of Honolulu", slug: "honolulu-water", category: "UTILITY_WATER", description: "Oahu municipal water customer account support; confirm service availability by address", website: "https://www.boardofwatersupply.com/customer-service/information-center/customer-service-request-forms/", phone: "1-808-748-5030", scope: "STATE", states: ["HI"], zipCodes: HAWAII_OAHU_ZIPS, popularityScore: 76, tags: ["water", "utility", "oahu", "honolulu-county", "address-check"] },
  { name: "Hawaiian Telcom", slug: "hawaiian-telcom", category: "UTILITY_INTERNET", description: "Fiber internet and phone services in Hawaii", website: "https://www.hawaiiantel.com", scope: "STATE", states: ["HI"], popularityScore: 74, tags: ["internet", "fiber", "phone"] },
  { name: "TheBus", slug: "thebus-hi", category: "TRANSPORTATION_TRANSIT", description: "Public transit service on Oahu", website: "https://www.thebus.org", scope: "STATE", states: ["HI"], popularityScore: 72, tags: ["transit", "bus"] },

  // ── Indiana ──
  { name: "Duke Energy Indiana", slug: "duke-in", category: "UTILITY_ELECTRIC", description: "Electric for central Indiana", website: "https://www.duke-energy.com/indiana", phone: "1-800-521-2232", scope: "STATE", states: ["IN"], popularityScore: 85, tags: ["electric"] },
  { name: "IndyGo", slug: "indygo", category: "TRANSPORTATION_TRANSIT", description: "Indianapolis public transit", website: "https://www.indygo.net", scope: "STATE", states: ["IN"], popularityScore: 70, tags: ["transit", "bus"] },
  { name: "Citizens Energy Group", slug: "citizens-energy-in", category: "UTILITY_GAS", description: "Natural gas and utility services in Indianapolis", website: "https://www.citizensenergygroup.com", scope: "STATE", states: ["IN"], popularityScore: 78, tags: ["gas", "water"] },
  { name: "Indiana American Water", slug: "indiana-american-water", category: "UTILITY_WATER", description: "Water and wastewater utility in Indiana", website: "https://www.amwater.com/inaw", scope: "STATE", states: ["IN"], popularityScore: 74, tags: ["water"] },
  { name: "Anthem BCBS Indiana", slug: "anthem-in", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Indiana", website: "https://www.anthem.com", scope: "STATE", states: ["IN"], popularityScore: 82, tags: ["health"] },

  // ── Iowa ──
  { name: "MidAmerican Energy", slug: "midamerican", category: "UTILITY_ELECTRIC", description: "Electric and gas for Iowa", website: "https://www.midamericanenergy.com", phone: "1-888-427-5632", scope: "STATE", states: ["IA"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Mediacom", slug: "mediacom-ia", category: "UTILITY_INTERNET", description: "Cable and broadband internet across Iowa", website: "https://www.mediacomcable.com", scope: "STATE", states: ["IA"], popularityScore: 74, tags: ["internet", "cable"] },
  { name: "Iowa American Water", slug: "iowa-american-water", category: "UTILITY_WATER", description: "Water utility serving communities in Iowa", website: "https://www.amwater.com/iaaw", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["water"] },
  { name: "Wellmark Blue Cross Blue Shield", slug: "wellmark-ia", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield coverage in Iowa", website: "https://www.wellmark.com", scope: "STATE", states: ["IA"], popularityScore: 82, tags: ["health"] },

  // ── Kansas ──
  { name: "Evergy", slug: "evergy", category: "UTILITY_ELECTRIC", description: "Electric for Kansas and Missouri", website: "https://www.evergy.com", phone: "1-888-471-5275", scope: "STATE", states: ["KS", "MO"], popularityScore: 88, tags: ["electric"] },
  { name: "K-TAG", slug: "ktag", category: "TRANSPORTATION_TOLL", description: "Kansas Turnpike toll tag", website: "https://www.ksturnpike.com", scope: "STATE", states: ["KS"], popularityScore: 75, tags: ["toll", "car"] },

  // ── Kentucky ──
  { name: "Kentucky Utilities", slug: "ky-utilities", category: "UTILITY_ELECTRIC", description: "Electric for Kentucky", website: "https://www.lge-ku.com", phone: "1-800-981-0600", scope: "STATE", states: ["KY"], popularityScore: 85, tags: ["electric"] },
  { name: "Louisville Water Company", slug: "louisville-water", category: "UTILITY_WATER", description: "Water utility for Louisville and surrounding areas", website: "https://www.louisvillewater.com", scope: "STATE", states: ["KY"], popularityScore: 78, tags: ["water"] },
  { name: "Atmos Energy Kentucky", slug: "atmos-ky", category: "UTILITY_GAS", description: "Natural gas service in Kentucky", website: "https://www.atmosenergy.com", scope: "STATE", states: ["KY"], popularityScore: 72, tags: ["gas"] },
  { name: "Anthem BCBS Kentucky", slug: "anthem-ky", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Kentucky", website: "https://www.anthem.com", scope: "STATE", states: ["KY"], popularityScore: 80, tags: ["health"] },

  // ── Louisiana ──
  { name: "Entergy Louisiana", slug: "entergy-la", category: "UTILITY_ELECTRIC", description: "Electric for Louisiana", website: "https://www.entergy-louisiana.com", phone: "1-800-368-3749", scope: "STATE", states: ["LA"], popularityScore: 90, tags: ["electric"] },
  { name: "GeauxPass", slug: "geauxpass", category: "TRANSPORTATION_TOLL", description: "Louisiana toll tag", website: "https://www.geauxpass.com", scope: "STATE", states: ["LA"], popularityScore: 75, tags: ["toll", "car"] },
  { name: "Sewerage & Water Board of New Orleans", slug: "swbno", category: "UTILITY_WATER", description: "Water and sewer utility for New Orleans", website: "https://www.swbno.org", scope: "STATE", states: ["LA"], popularityScore: 74, tags: ["water"] },
  { name: "Blue Cross and Blue Shield of Louisiana", slug: "bcbs-la", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Louisiana", website: "https://www.bcbsla.com", scope: "STATE", states: ["LA"], popularityScore: 84, tags: ["health"] },
  { name: "New Orleans Regional Transit Authority", slug: "norta", category: "TRANSPORTATION_TRANSIT", description: "Streetcar, bus, and ferry transit in New Orleans", website: "https://www.norta.com", scope: "STATE", states: ["LA"], popularityScore: 70, tags: ["transit", "bus", "streetcar"] },

  // ── Minnesota ──
  { name: "BCBS Minnesota", slug: "bcbs-mn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Minnesota", website: "https://www.bluecrossmn.com", scope: "STATE", states: ["MN"], popularityScore: 85, tags: ["health"] },
  { name: "Metro Transit MN", slug: "metro-mn", category: "TRANSPORTATION_TRANSIT", description: "Minneapolis-St. Paul transit", website: "https://www.metrotransit.org", scope: "STATE", states: ["MN"], popularityScore: 82, tags: ["transit", "bus", "train"] },
  { name: "MNsure", slug: "mnsure", category: "FINANCIAL_INSURANCE_HEALTH", description: "MN Health Insurance Marketplace", website: "https://www.mnsure.org", scope: "STATE", states: ["MN"], popularityScore: 72, tags: ["health", "marketplace"] },

  // ── Missouri ──
  { name: "Ameren Missouri", slug: "ameren-mo", category: "UTILITY_ELECTRIC", description: "Electric and gas for Missouri", website: "https://www.ameren.com", phone: "1-800-552-7583", scope: "STATE", states: ["MO", "IL"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Spire Missouri", slug: "spire-mo", category: "UTILITY_GAS", description: "Natural gas utility for Missouri", website: "https://www.spireenergy.com", scope: "STATE", states: ["MO"], popularityScore: 76, tags: ["gas"] },
  { name: "Missouri American Water", slug: "missouri-american-water", category: "UTILITY_WATER", description: "Water and wastewater utility in Missouri", website: "https://www.amwater.com/moaw", scope: "STATE", states: ["MO"], popularityScore: 74, tags: ["water"] },
  { name: "Metro Transit St. Louis", slug: "metro-stl", category: "TRANSPORTATION_TRANSIT", description: "Bus and MetroLink transit in St. Louis", website: "https://www.metrostlouis.org", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["transit", "bus", "train"] },

  // ── Nevada ──
  { name: "NV Energy", slug: "nv-energy", category: "UTILITY_ELECTRIC", description: "Nevada electric and limited natural gas start, stop, move, and account support; confirm service availability by address", website: "https://www.nvenergy.com/my-account/ss-landing", phone: "1-702-402-5555", scope: "STATE", states: ["NV"], zipCodes: NV_ENERGY_ZIPS, popularityScore: 92, tags: ["electric", "gas", "utility", "nevada", "address-check"] },
  { name: "Las Vegas Valley Water District", slug: "lvvwd", category: "UTILITY_WATER", description: "Southern Nevada retail water start, stop, transfer, and customer account support; confirm service availability by address", website: "https://www.lvvwd.com/customer-service/water-service/start-stop-service.html", phone: "1-702-870-4194", scope: "STATE", states: ["NV"], zipCodes: NV_LAS_VEGAS_VALLEY_ZIPS, popularityScore: 82, tags: ["water", "utility", "las-vegas", "address-check"] },
  { name: "Truckee Meadows Water Authority", slug: "tmwa", category: "UTILITY_WATER", description: "Reno-Sparks-area water start, stop, transfer, and account support; confirm service availability by address", website: "https://tmwa.com/start-stop-or-transfer-service/", scope: "STATE", states: ["NV"], zipCodes: NV_RENO_SPARKS_ZIPS, popularityScore: 76, tags: ["water", "utility", "reno", "sparks", "address-check"] },
  { name: "City of Henderson Utility Services", slug: "henderson-utility-services", category: "UTILITY_WATER", description: "Henderson municipal water and sewer start, stop, transfer, and utility account support", website: "https://www.cityofhenderson.com/government/departments/utility-services/businesses/start-stop-and-transfer-service", scope: "STATE", states: ["NV"], zipCodes: ["890", "891"], popularityScore: 74, tags: ["water", "sewer", "utility", "henderson", "address-check"] },
  { name: "City of North Las Vegas Utilities Department", slug: "north-las-vegas-utilities", category: "UTILITY_WATER", description: "North Las Vegas municipal utility billing, new-location service requests, and account support", website: "https://payutil.cityofnorthlasvegas.com/", scope: "STATE", states: ["NV"], zipCodes: ["890", "891"], popularityScore: 72, tags: ["water", "trash", "utility", "north-las-vegas", "address-check"] },
  { name: "Clark County Water Reclamation District", slug: "clark-county-water-reclamation", category: "UTILITY_SEWER", description: "Southern Nevada sewer billing, account, owner, and address-change support; confirm service availability by address", website: "https://www.cleanwaterteam.com/", scope: "STATE", states: ["NV"], zipCodes: NV_SOUTHERN_ZIPS, popularityScore: 72, tags: ["sewer", "wastewater", "utility", "clark-county", "address-check"] },
  { name: "City of Reno Sewer Service", slug: "reno-sewer-service", category: "UTILITY_SEWER", description: "Reno sewer billing, new account, mailing-address change, and utility service support", website: "https://www.reno.gov/government/departments/finance/sewer-service", scope: "STATE", states: ["NV"], zipCodes: NV_RENO_SPARKS_ZIPS, popularityScore: 68, tags: ["sewer", "utility", "reno", "address-check"] },
  { name: "Carson City Utility Billing", slug: "carson-city-utility-billing", category: "UTILITY_WATER", description: "Carson City water, sewer, stormwater, residential application, and utility billing support", website: "https://www.carson.org/business/water-and-sewer-services", scope: "STATE", states: ["NV"], zipCodes: NV_CARSON_CITY_ZIPS, popularityScore: 68, tags: ["water", "sewer", "stormwater", "utility", "carson-city", "address-check"] },
  { name: "Virgin Valley Water District", slug: "virgin-valley-water-district", category: "UTILITY_WATER", description: "Mesquite-area water sign-up, stop-service, and account support; confirm service availability by address", website: "https://vvwdnv.com/sign-up-for-service", scope: "STATE", states: ["NV"], zipCodes: ["890"], popularityScore: 64, tags: ["water", "utility", "mesquite", "address-check"] },
  { name: "Great Basin Water", slug: "great-basin-water", category: "UTILITY_WATER", description: "Nevada private water and wastewater account, billing, and customer service support; confirm service availability by address", website: "https://www.myutility.us/greatbasinwater", scope: "STATE", states: ["NV"], zipCodes: NV_PRIVATE_WATER_ZIPS, popularityScore: 64, tags: ["water", "wastewater", "utility", "address-check"] },
  { name: "Republic Services of Southern Nevada", slug: "republic-services-southern-nevada", category: "UTILITY_TRASH", description: "Southern Nevada waste and recycling customer service, pickup, and account support; confirm service by address", website: "https://www.republicservices.com/municipality/southern-nevada", scope: "STATE", states: ["NV"], zipCodes: NV_SOUTHERN_ZIPS, popularityScore: 72, tags: ["trash", "recycling", "waste", "southern-nevada", "address-check"] },
  { name: "WM Nevada", slug: "wm-nevada", category: "UTILITY_TRASH", description: "Nevada residential trash and recycling service support, especially Northern Nevada; confirm availability by address", website: "https://www.wm.com/us/en/location/nv", scope: "STATE", states: ["NV"], zipCodes: NV_WM_ZIPS, popularityScore: 68, tags: ["trash", "recycling", "waste", "nevada", "address-check"] },
  { name: "Valley Electric Association", slug: "valley-electric-association", category: "UTILITY_ELECTRIC", description: "Southern Nevada cooperative electric start, stop, and account support; confirm service availability by address", website: "https://www.vea.coop/member-services/start-stop/", scope: "STATE", states: ["NV"], zipCodes: ["890"], popularityScore: 66, tags: ["electric", "cooperative", "southern-nevada", "address-check"] },
  { name: "Overton Power District No. 5", slug: "overton-power-district", category: "UTILITY_ELECTRIC", description: "Moapa Valley and Mesquite-area public power new-service, transfer, and account support", website: "https://opd5.com/customer-information/application-for-new-service/", scope: "STATE", states: ["NV"], zipCodes: ["890"], popularityScore: 64, tags: ["electric", "public-power", "moapa-valley", "mesquite", "address-check"] },
  { name: "Lincoln County Power District No. 1", slug: "lincoln-county-power-district", category: "UTILITY_ELECTRIC", description: "Lincoln County electric start, stop, new-service, and account support; confirm service availability by address", website: "https://www.lcpd1.com/form/start-or-stop-service", scope: "STATE", states: ["NV"], zipCodes: ["890"], popularityScore: 62, tags: ["electric", "public-power", "lincoln-county", "address-check"] },
  { name: "Mt. Wheeler Power", slug: "mt-wheeler-power", category: "UTILITY_ELECTRIC", description: "Eastern Nevada cooperative electric new-service and member account support; confirm service availability by address", website: "https://www.mwpower.net/new-service-upgrade-request", scope: "STATE", states: ["NV"], zipCodes: ["893", "898"], popularityScore: 62, tags: ["electric", "cooperative", "eastern-nevada", "address-check"] },
  { name: "Wells Rural Electric Company", slug: "wells-rural-electric", category: "UTILITY_ELECTRIC", description: "Northeastern Nevada rural cooperative electric start, stop, transfer, and account support", website: "https://www.wrec.coop/member-services/start-stop-transfer-service/", scope: "STATE", states: ["NV"], zipCodes: ["898"], popularityScore: 62, tags: ["electric", "cooperative", "rural-nevada", "address-check"] },
  { name: "Boulder City Utilities", slug: "boulder-city-utilities", category: "UTILITY_ELECTRIC", description: "Boulder City municipal electric, water, wastewater, start/stop notice, and utility billing support", website: "https://bcnv.org/321/Utilities---Billing", scope: "STATE", states: ["NV"], zipCodes: ["890"], popularityScore: 62, tags: ["electric", "water", "wastewater", "municipal-utility", "boulder-city", "address-check"] },
  { name: "Nevada Health Link", slug: "nevada-health-link", category: "FINANCIAL_INSURANCE_HEALTH", description: "Nevada's health insurance marketplace", website: "https://www.nevadahealthlink.com", scope: "STATE", states: ["NV"], popularityScore: 78, tags: ["health", "marketplace"] },
  { name: "RTC Southern Nevada", slug: "rtc-snv", category: "TRANSPORTATION_TRANSIT", description: "Public transit service in Las Vegas and Southern Nevada", website: "https://www.rtcsnv.com", scope: "STATE", states: ["NV"], popularityScore: 72, tags: ["transit", "bus"] },

  // ── Oregon ──
  { name: "Portland General Electric", slug: "pge-or", category: "UTILITY_ELECTRIC", description: "Portland metro and northern Willamette Valley electric start, stop, move, and account support; confirm service availability by address", website: "https://portlandgeneral.com/start-stop-move", phone: "1-503-228-6322", scope: "STATE", states: ["OR"], zipCodes: OR_PGE_ZIPS, popularityScore: 88, tags: ["electric", "utility", "portland", "willamette-valley", "address-check"] },
  { name: "NW Natural", slug: "nw-natural", category: "UTILITY_GAS", description: "Oregon and Southwest Washington natural gas start, stop, transfer, and account support; confirm service availability by address", website: "https://www.nwnatural.com/account/start-stop-transfer", phone: "1-800-422-4012", scope: "STATE", states: ["OR", "WA"], zipCodes: PNW_NW_NATURAL_ZIPS, popularityScore: 82, tags: ["gas", "utility", "oregon", "southwest-washington", "address-check"] },
  { name: "TriMet", slug: "trimet", category: "TRANSPORTATION_TRANSIT", description: "Portland area transit", website: "https://www.trimet.org", phone: "1-503-238-7433", scope: "STATE", states: ["OR"], popularityScore: 85, tags: ["transit", "bus", "train"] },

  // ── Tennessee ──
  { name: "Nashville Electric Service", slug: "nes-tn", category: "UTILITY_ELECTRIC", description: "Electric for Nashville", website: "https://www.nespower.com", phone: "1-615-736-6900", scope: "STATE", states: ["TN"], popularityScore: 85, tags: ["electric"] },
  { name: "BCBS Tennessee", slug: "bcbs-tn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Tennessee", website: "https://www.bcbst.com", phone: "1-800-565-9140", scope: "STATE", states: ["TN"], popularityScore: 88, tags: ["health"] },
  { name: "Nashville Water Services", slug: "nashville-water", category: "UTILITY_WATER", description: "Water and sewer utility for Nashville", website: "https://www.nashville.gov/departments/water", scope: "STATE", states: ["TN"], popularityScore: 74, tags: ["water"] },
  { name: "WeGo Public Transit", slug: "wego-tn", category: "TRANSPORTATION_TRANSIT", description: "Bus transit service in Nashville", website: "https://www.wegotransit.com", scope: "STATE", states: ["TN"], popularityScore: 70, tags: ["transit", "bus"] },

  // ── Utah ──
  { name: "Rocky Mountain Power", slug: "rmp-ut", category: "UTILITY_ELECTRIC", description: "Electric start, stop, move, and account support in Utah, Wyoming, and Idaho; confirm service availability by address", website: "https://www.rockymountainpower.net/my-account/start-stop-move.html", phone: "1-888-221-7070", scope: "STATE", states: ["UT", "WY", "ID"], popularityScore: 88, tags: ["electric", "utility", "start-stop-service", "address-check"] },
  { name: "UTA", slug: "uta", category: "TRANSPORTATION_TRANSIT", description: "Utah Transit Authority", website: "https://www.rideuta.com", scope: "STATE", states: ["UT"], popularityScore: 82, tags: ["transit", "bus", "train"] },

  // ── Wisconsin ──
  { name: "We Energies", slug: "we-energies", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Wisconsin", website: "https://www.we-energies.com", phone: "1-800-242-9137", scope: "STATE", states: ["WI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Milwaukee Water Works", slug: "milwaukee-water", category: "UTILITY_WATER", description: "Water utility for Milwaukee", website: "https://city.milwaukee.gov/water", scope: "STATE", states: ["WI"], popularityScore: 74, tags: ["water"] },
  { name: "WPS Health Insurance", slug: "wps-health", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health plans and provider networks in Wisconsin", website: "https://www.wpshealth.com", scope: "STATE", states: ["WI"], popularityScore: 76, tags: ["health"] },
  { name: "Milwaukee County Transit System", slug: "mcts", category: "TRANSPORTATION_TRANSIT", description: "Bus transit service in Milwaukee County", website: "https://www.ridemcts.com", scope: "STATE", states: ["WI"], popularityScore: 70, tags: ["transit", "bus"] },

  // ── Multi-State ISPs ──
  { name: "Cox Communications", slug: "cox", category: "UTILITY_INTERNET", description: "Internet, TV, phone", website: "https://www.cox.com", phone: "1-800-234-3993", scope: "STATE", states: ["AZ", "AR", "CA", "CT", "FL", "GA", "ID", "IA", "KS", "LA", "NE", "NV", "OH", "OK", "RI", "VA"], popularityScore: 80, tags: ["internet", "cable", "tv"] },
  { name: "Frontier Communications", slug: "frontier", category: "UTILITY_INTERNET", description: "Fiber and DSL internet", website: "https://www.frontier.com", phone: "1-855-575-0432", scope: "STATE", states: ["AL", "AZ", "CA", "CT", "FL", "IL", "IN", "NY", "OH", "OR", "PA", "TX", "WA", "WV", "WI"], popularityScore: 68, tags: ["internet", "fiber"] },
  { name: "CenturyLink (Lumen)", slug: "centurylink", category: "UTILITY_INTERNET", description: "Internet and fiber by Lumen", website: "https://www.centurylink.com", phone: "1-855-454-8739", scope: "STATE", states: ["AL", "AZ", "AR", "CO", "FL", "GA", "ID", "IL", "IN", "IA", "KS", "LA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NM", "NC", "OH", "OK", "OR", "PA", "TX", "UT", "VA", "WA", "WI"], popularityScore: 72, tags: ["internet", "fiber"] },
  { name: "Google Fiber", slug: "google-fiber", category: "UTILITY_INTERNET", description: "Gigabit fiber internet by Google", website: "https://fiber.google.com", scope: "STATE", states: ["TX", "NC", "TN", "GA", "MO", "KS", "UT", "CO", "AZ", "NE", "NV", "IA"], popularityScore: 78, tags: ["internet", "fiber"] },

  // ── Multi-State Grocery / Retail ──
  { name: "Wegmans", slug: "wegmans", category: "SHOPPING_RETAIL", description: "Family-owned supermarket", website: "https://www.wegmans.com", scope: "STATE", states: ["NY", "NJ", "PA", "MA", "MD", "VA", "NC", "DE"], popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "ShopRite", slug: "shoprite", category: "SHOPPING_RETAIL", description: "Northeast supermarket cooperative", website: "https://www.shoprite.com", scope: "STATE", states: ["NJ", "NY", "CT", "PA", "DE", "MD"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Meijer", slug: "meijer", category: "SHOPPING_RETAIL", description: "Midwest supercenter chain", website: "https://www.meijer.com", scope: "STATE", states: ["MI", "OH", "IN", "IL", "WI", "KY"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Kroger", slug: "kroger", category: "SHOPPING_RETAIL", description: "Grocery chain in 35 states", website: "https://www.kroger.com", phone: "1-800-576-4377", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "Safeway", slug: "safeway", category: "SHOPPING_RETAIL", description: "Grocery chain in western US", website: "https://www.safeway.com", scope: "STATE", states: ["AK", "AZ", "CA", "CO", "DC", "DE", "HI", "ID", "MD", "MT", "NE", "NM", "NV", "OR", "SD", "VA", "WA", "WY"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Hy-Vee", slug: "hy-vee", category: "SHOPPING_RETAIL", description: "Midwest supermarket chain", website: "https://www.hy-vee.com", scope: "STATE", states: ["IA", "IL", "KS", "MN", "MO", "NE", "SD", "WI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "WinCo Foods", slug: "winco", category: "SHOPPING_RETAIL", description: "Employee-owned discount grocery chain", website: "https://www.wincofoods.com", scope: "STATE", states: ["AZ", "CA", "ID", "MT", "NV", "OK", "OR", "TX", "UT", "WA"], popularityScore: 72, tags: ["shopping", "grocery", "budget"] },
  { name: "Giant Food", slug: "giant-food", category: "SHOPPING_RETAIL", description: "Mid-Atlantic grocery chain", website: "https://www.giantfood.com", scope: "STATE", states: ["DC", "DE", "MD", "PA", "VA"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Stop & Shop", slug: "stop-shop", category: "SHOPPING_RETAIL", description: "Northeast supermarket chain", website: "https://www.stopandshop.com", scope: "STATE", states: ["CT", "MA", "NJ", "NY", "RI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "Fred Meyer", slug: "fred-meyer", category: "SHOPPING_RETAIL", description: "Pacific Northwest one-stop shopping chain", website: "https://www.fredmeyer.com", scope: "STATE", states: ["AK", "ID", "OR", "WA"], popularityScore: 72, tags: ["shopping", "grocery"] },
  { name: "Albertsons", slug: "albertsons", category: "SHOPPING_RETAIL", description: "Regional grocery store network", website: "https://www.albertsons.com", scope: "STATE", states: ["AR", "AZ", "CA", "CO", "ID", "LA", "MT", "NE", "NV", "NM", "ND", "OR", "SD", "TX", "UT", "WA", "WY"], popularityScore: 78, tags: ["shopping", "grocery"] },

  // ── Maine (ME) — Coverage Gap Fix ──
  { name: "Central Maine Power", slug: "cmp-me", category: "UTILITY_ELECTRIC", description: "Electric utility for central and southern Maine", website: "https://www.cmpco.com", phone: "1-800-750-4000", scope: "STATE", states: ["ME"], popularityScore: 88, tags: ["electric"] },
  { name: "Versant Power", slug: "versant-me", category: "UTILITY_ELECTRIC", description: "Electric utility for northern Maine", website: "https://www.versantpower.com", phone: "1-207-973-2000", scope: "STATE", states: ["ME"], popularityScore: 72, tags: ["electric"] },
  { name: "Spectrum Maine", slug: "spectrum-me", category: "UTILITY_INTERNET", description: "Internet and cable in Maine", website: "https://www.spectrum.com", phone: "1-855-757-7328", scope: "STATE", states: ["ME"], popularityScore: 82, tags: ["internet", "cable", "address-check"] },
  { name: "Maine Water Company", slug: "maine-water", category: "UTILITY_WATER", description: "Water utility serving Maine", website: "https://www.mainewater.com", phone: "1-800-287-1643", scope: "STATE", states: ["ME"], popularityScore: 75, tags: ["water"] },
  { name: "Anthem BCBS Maine", slug: "bcbs-me", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Maine", website: "https://www.anthem.com", scope: "STATE", states: ["ME"], popularityScore: 85, tags: ["health"] },

  // ── North Dakota (ND) — Coverage Gap Fix ──
  { name: "MDU Resources", slug: "mdu-nd", category: "UTILITY_ELECTRIC", description: "Electric and gas for North Dakota", website: "https://www.montana-dakota.com", phone: "1-800-638-3278", scope: "STATE", states: ["ND", "MT", "SD", "WY"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "Xcel Energy ND", slug: "xcel-nd", category: "UTILITY_ELECTRIC", description: "Electric utility serving ND", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["ND", "MN", "WI", "SD"], popularityScore: 82, tags: ["electric"] },
  { name: "Midco", slug: "midco-nd", category: "UTILITY_INTERNET", description: "Internet and cable in ND/SD/MN/WI/KS", website: "https://www.midco.com", phone: "1-800-888-1300", scope: "STATE", states: ["ND", "SD", "MN", "WI", "KS"], popularityScore: 78, tags: ["internet", "cable"] },
  { name: "BCBS North Dakota", slug: "bcbs-nd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of North Dakota", website: "https://www.bcbsnd.com", scope: "STATE", states: ["ND"], popularityScore: 85, tags: ["health"] },

  // ── Vermont (VT) — Coverage Gap Fix ──
  { name: "Green Mountain Power", slug: "gmp-vt", category: "UTILITY_ELECTRIC", description: "Vermont's largest electric utility", website: "https://www.greenmountainpower.com", phone: "1-888-835-4672", scope: "STATE", states: ["VT"], popularityScore: 90, tags: ["electric"] },
  { name: "Vermont Gas Systems", slug: "vt-gas", category: "UTILITY_GAS", description: "Natural gas for NW Vermont", website: "https://www.vermontgas.com", phone: "1-802-863-4511", scope: "STATE", states: ["VT"], popularityScore: 72, tags: ["gas"] },
  { name: "Consolidated Communications VT", slug: "consolidated-vt", category: "UTILITY_INTERNET", description: "Internet and phone for Vermont", website: "https://www.consolidated.com", phone: "1-844-968-7224", scope: "STATE", states: ["VT", "NH", "ME"], popularityScore: 70, tags: ["internet"] },
  { name: "BCBS Vermont", slug: "bcbs-vt", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Vermont", website: "https://www.bcbsvt.com", scope: "STATE", states: ["VT"], popularityScore: 88, tags: ["health"] },

  // ── New Hampshire (NH) — Coverage Gap Fix ──
  { name: "Eversource Energy New Hampshire Electric", slug: "eversource-nh", category: "UTILITY_ELECTRIC", description: "New Hampshire electric utility account support; confirm service availability by address", website: "https://www.eversource.com/residential/services/start-stop-or-transfer-service", phone: "1-800-662-7764", scope: "STATE", states: ["NH"], popularityScore: 86, tags: ["electric", "utility", "new-hampshire", "address-check"] },
  { name: "Liberty Utilities New Hampshire Electric", slug: "liberty-nh", category: "UTILITY_ELECTRIC", description: "New Hampshire electric utility account support for Granite State Electric territory; confirm service availability by address", website: "https://new-hampshire.libertyutilities.com/lyme/residential/my-account/moving-residential-new-hampshire-electric-liberty.html", phone: "1-800-375-7413", scope: "STATE", states: ["NH"], zipCodes: NH_LIBERTY_ELECTRIC_ZIPS, popularityScore: 74, tags: ["electric", "utility", "new-hampshire", "liberty", "address-check"] },
  { name: "Anthem BCBS NH", slug: "bcbs-nh", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of NH", website: "https://www.anthem.com", scope: "STATE", states: ["NH"], popularityScore: 85, tags: ["health"] },

  // ── South Dakota (SD) — Coverage Gap Fix ──
  { name: "Black Hills Energy SD", slug: "bhe-sd", category: "UTILITY_ELECTRIC", description: "Electric and gas for South Dakota and nearby Black Hills Energy operating territories", website: "https://www.blackhillsenergy.com", phone: "1-800-742-8948", scope: "STATE", states: ["SD", "WY", "NE", "IA", "KS"], popularityScore: 82, tags: ["electric", "gas"] },
  { name: "Avera Health", slug: "avera-sd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Major health system in SD", website: "https://www.avera.org", scope: "STATE", states: ["SD"], popularityScore: 80, tags: ["health"] },

  // ── West Virginia (WV) — Coverage Gap Fix ──
  { name: "Appalachian Power", slug: "apco-wv", category: "UTILITY_ELECTRIC", description: "Virginia and West Virginia electric start, stop, transfer, and account support; confirm service availability by address", website: "https://www.appalachianpower.com/account/service/start-stop-transfer", phone: "1-800-956-4237", scope: "STATE", states: ["WV", "VA"], popularityScore: 85, tags: ["electric", "utility", "appalachian-power", "address-check"] },
  { name: "Mon Power", slug: "mon-power-wv", category: "UTILITY_ELECTRIC", description: "Electric for northern West Virginia", website: "https://www.firstenergycorp.com/monpower", phone: "1-800-686-0022", scope: "STATE", states: ["WV"], popularityScore: 78, tags: ["electric"] },
  { name: "West Virginia American Water", slug: "wvaw", category: "UTILITY_WATER", description: "Water utility for West Virginia", website: "https://www.amwater.com/wvaw", phone: "1-800-685-8660", scope: "STATE", states: ["WV"], popularityScore: 78, tags: ["water"] },
  { name: "Highmark BCBS WV", slug: "bcbs-wv", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of WV", website: "https://www.highmarkbcbswv.com", scope: "STATE", states: ["WV"], popularityScore: 85, tags: ["health"] },

  // ══════════════════════════════════════════════════════════
  // NEW CATEGORIES — Phase 3 Expansion
  // ══════════════════════════════════════════════════════════

  // ── HOME SECURITY ──
  { name: "ADT Security", slug: "adt", category: "HOUSING_SECURITY", description: "America's #1 smart home security provider", website: "https://www.adt.com", phone: "1-800-716-3640", scope: "FEDERAL", popularityScore: 90, tags: ["security", "alarm", "home"] },
  { name: "Vivint Smart Home", slug: "vivint", category: "HOUSING_SECURITY", description: "Smart home security and automation", website: "https://www.vivint.com", phone: "1-855-832-1550", scope: "FEDERAL", popularityScore: 82, tags: ["security", "alarm", "home"] },
  { name: "SimpliSafe", slug: "simplisafe", category: "HOUSING_SECURITY", description: "DIY home security — no contract", website: "https://www.simplisafe.com", phone: "1-888-957-4675", scope: "FEDERAL", popularityScore: 80, tags: ["security", "alarm", "home"] },
  { name: "Ring Alarm", slug: "ring-alarm", category: "HOUSING_SECURITY", description: "Amazon Ring home security system", website: "https://www.ring.com", scope: "FEDERAL", popularityScore: 78, tags: ["security", "alarm", "home"] },
  { name: "Brinks Home Security", slug: "brinks-home", category: "HOUSING_SECURITY", description: "Professional home security monitoring", website: "https://www.brinkshome.com", phone: "1-888-627-4657", scope: "FEDERAL", popularityScore: 72, tags: ["security", "alarm", "home"] },
  { name: "Cove Security", slug: "cove", category: "HOUSING_SECURITY", description: "Affordable DIY smart security", website: "https://www.covesmart.com", scope: "FEDERAL", popularityScore: 60, tags: ["security", "alarm", "home"] },

  // ── HOME CLEANING ──
  { name: "Molly Maid", slug: "molly-maid", category: "HOUSING_CLEANING", description: "Professional home cleaning services", website: "https://www.mollymaid.com", phone: "1-800-665-5962", scope: "FEDERAL", popularityScore: 78, tags: ["cleaning", "home"] },
  { name: "Merry Maids", slug: "merry-maids", category: "HOUSING_CLEANING", description: "Trusted residential cleaning since 1979", website: "https://www.merrymaids.com", phone: "1-800-637-7962", scope: "FEDERAL", popularityScore: 75, tags: ["cleaning", "home"] },
  { name: "The Maids", slug: "the-maids", category: "HOUSING_CLEANING", description: "Team-based home cleaning", website: "https://www.maids.com", phone: "1-800-843-6243", scope: "FEDERAL", popularityScore: 68, tags: ["cleaning", "home"] },
  { name: "Handy", slug: "handy", category: "HOUSING_CLEANING", description: "On-demand cleaning and handyman services", website: "https://www.handy.com", scope: "FEDERAL", popularityScore: 65, tags: ["cleaning", "home"] },

  // ── GROCERY DELIVERY ──
  { name: "Instacart", slug: "instacart", category: "GROCERY_DELIVERY", description: "Same-day grocery delivery from local stores", website: "https://www.instacart.com", scope: "FEDERAL", popularityScore: 90, tags: ["grocery", "delivery"] },
  { name: "Amazon Fresh", slug: "amazon-fresh", category: "GROCERY_DELIVERY", description: "Grocery delivery by Amazon", website: "https://www.amazon.com/fresh", scope: "FEDERAL", popularityScore: 85, tags: ["grocery", "delivery"] },
  { name: "Walmart+ Delivery", slug: "walmart-plus", category: "GROCERY_DELIVERY", description: "Unlimited free delivery from Walmart", website: "https://www.walmart.com/plus", scope: "FEDERAL", popularityScore: 82, tags: ["grocery", "delivery"] },
  { name: "Shipt", slug: "shipt", category: "GROCERY_DELIVERY", description: "Same-day delivery from Target and more", website: "https://www.shipt.com", scope: "FEDERAL", popularityScore: 72, tags: ["grocery", "delivery"] },
  { name: "HelloFresh", slug: "hellofresh", category: "GROCERY_DELIVERY", description: "Meal kit delivery service", website: "https://www.hellofresh.com", scope: "FEDERAL", popularityScore: 75, tags: ["grocery", "delivery"] },
  { name: "Blue Apron", slug: "blue-apron", category: "GROCERY_DELIVERY", description: "Chef-designed meal kits delivered weekly", website: "https://www.blueapron.com", scope: "FEDERAL", popularityScore: 62, tags: ["grocery", "delivery"] },
  { name: "DoorDash", slug: "doordash", category: "GROCERY_DELIVERY", description: "Food and grocery delivery", website: "https://www.doordash.com", scope: "FEDERAL", popularityScore: 88, tags: ["grocery", "delivery"] },

  // ── PET SERVICES ──
  { name: "Rover", slug: "rover", category: "PET_SERVICES", description: "Dog walking, pet sitting, boarding", website: "https://www.rover.com", scope: "FEDERAL", popularityScore: 82, tags: ["pet", "dog", "cat"] },
  { name: "Wag!", slug: "wag", category: "PET_SERVICES", description: "On-demand dog walking and pet care", website: "https://www.wagwalking.com", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "dog"] },
  { name: "PetSmart", slug: "petsmart", category: "PET_SERVICES", description: "Pet supplies, grooming, boarding, training", website: "https://www.petsmart.com", phone: "1-888-839-9638", scope: "FEDERAL", popularityScore: 85, tags: ["pet", "dog", "cat"] },
  { name: "Petco", slug: "petco", category: "PET_SERVICES", description: "Pet health, supplies, and veterinary care", website: "https://www.petco.com", phone: "1-877-738-6742", scope: "FEDERAL", popularityScore: 82, tags: ["pet", "dog", "cat", "vet"] },
  { name: "Camp Bow Wow", slug: "camp-bow-wow", category: "PET_SERVICES", description: "Dog daycare, boarding, and grooming", website: "https://www.campbowwow.com", scope: "FEDERAL", popularityScore: 64, tags: ["pet", "dog"] },
  { name: "Dogtopia", slug: "dogtopia", category: "PET_SERVICES", description: "Dog daycare, boarding, and spa services", website: "https://www.dogtopia.com", scope: "FEDERAL", popularityScore: 62, tags: ["pet", "dog"] },

  // ── MOVING SERVICES ──

  // ── LEGAL SERVICES ──
  { name: "LegalZoom", slug: "legalzoom", category: "LEGAL_SERVICES", description: "Online legal services — wills, LLC, address change", website: "https://www.legalzoom.com", phone: "1-800-773-0888", scope: "FEDERAL", popularityScore: 78, tags: ["legal"] },
  { name: "Rocket Lawyer", slug: "rocket-lawyer", category: "LEGAL_SERVICES", description: "Legal documents and attorney access", website: "https://www.rocketlawyer.com", scope: "FEDERAL", popularityScore: 68, tags: ["legal"] },

  // ── LAWN CARE ──
  { name: "Lawn Love", slug: "lawn-love", category: "HOUSING_LAWN_CARE", description: "On-demand lawn care and landscaping", website: "https://www.lawnlove.com", scope: "FEDERAL", popularityScore: 65, tags: ["lawn", "home"] },
  { name: "Sunday Lawn Care", slug: "sunday-lawn", category: "HOUSING_LAWN_CARE", description: "Custom lawn care plan delivered to your door", website: "https://www.getsunday.com", scope: "FEDERAL", popularityScore: 60, tags: ["lawn", "home"] },

  // ── PEST CONTROL ──
  { name: "Rentokil (Ehrlich)", slug: "rentokil", category: "HOUSING_PEST_CONTROL", description: "Pest control services", website: "https://www.rentokil.com/us", scope: "FEDERAL", popularityScore: 68, tags: ["pest", "home"] },

  // ── SMART HOME ──
  { name: "Google Nest", slug: "google-nest", category: "HOUSING_SECURITY", subCategory: "SMART_HOME", description: "Smart thermostat, cameras, doorbell", website: "https://store.google.com/category/nest", scope: "FEDERAL", popularityScore: 78, tags: ["security", "home"] },
  { name: "Arlo", slug: "arlo", category: "HOUSING_SECURITY", subCategory: "SMART_HOME", description: "Wire-free smart security cameras", website: "https://www.arlo.com", scope: "FEDERAL", popularityScore: 70, tags: ["security", "home"] },

  // ── IDENTITY PROTECTION ──
  { name: "Experian IdentityWorks", slug: "experian-id", category: "FINANCIAL_CREDIT_CARD", subCategory: "IDENTITY", description: "Credit monitoring and identity protection", website: "https://www.experian.com/consumer-products/identity-theft-and-credit-protection.html", scope: "FEDERAL", popularityScore: 72, tags: ["identity", "security"] },
  { name: "Credit Karma", slug: "credit-karma", category: "FINANCIAL_CREDIT_CARD", subCategory: "CREDIT", description: "Free credit scores and monitoring", website: "https://www.creditkarma.com", scope: "FEDERAL", popularityScore: 85, tags: ["identity", "banking"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — ELECTRIC (2026-04-17)
  // Fills gaps flagged by scripts/audit-provider-coverage.ts
  // ══════════════════════════════════════════════════════════
  { name: "Delmarva Power", slug: "delmarva-power-de", category: "UTILITY_ELECTRIC", description: "Delaware and Maryland Eastern Shore electric and natural gas start, stop, move, and account support; confirm service availability by address", website: "https://www.delmarva.com/MyAccount/MyService/Pages/StartStopMove.aspx", phone: "1-800-375-7117", scope: "STATE", states: ["DE", "MD"], popularityScore: 85, tags: ["electric", "gas", "utility", "delmarva", "eastern-shore", "address-check"] },
  { name: "Mississippi Power", slug: "mississippi-power", category: "UTILITY_ELECTRIC", description: "Electric utility for southeast Mississippi", website: "https://www.mississippipower.com", phone: "1-800-532-1502", scope: "STATE", states: ["MS"], popularityScore: 86, tags: ["electric"] },
  { name: "Entergy Mississippi", slug: "entergy-ms", category: "UTILITY_ELECTRIC", description: "Electric utility for west-central Mississippi", website: "https://www.entergy-mississippi.com", phone: "1-800-368-3749", scope: "STATE", states: ["MS"], popularityScore: 82, tags: ["electric"] },
  { name: "PNM", slug: "pnm-nm", category: "UTILITY_ELECTRIC", description: "Public Service Company of New Mexico", website: "https://www.pnm.com", phone: "1-888-342-5766", scope: "STATE", states: ["NM"], popularityScore: 88, tags: ["electric"] },
  { name: "OG&E", slug: "oge-ok", category: "UTILITY_ELECTRIC", description: "Oklahoma Gas & Electric electric utility account support; confirm service availability by address", website: "https://www.oge.com/web/portal/label_ord/residential/startstoptransfer/overview", phone: "1-405-272-9741", scope: "STATE", states: ["OK"], popularityScore: 88, tags: ["electric", "utility", "address-check"] },
  { name: "Oklahoma Gas & Electric (OG&E) - Arkansas Service Area", slug: "oge-ar", category: "UTILITY_ELECTRIC", description: "Fort Smith-area Arkansas electric start, stop, transfer, and account support from OG&E; confirm service availability by address", website: "https://www.oge.com/web/portal/label_ord/residential/startstoptransfer/overview", phone: "1-405-272-9741", scope: "STATE", states: ["AR"], zipCodes: AR_OGE_ZIPS, popularityScore: 70, tags: ["electric", "utility", "fort-smith", "western-arkansas", "address-check"] },
  { name: "Public Service Oklahoma (PSO)", slug: "pso-ok", category: "UTILITY_ELECTRIC", description: "Electric utility for eastern Oklahoma", website: "https://www.psoklahoma.com", phone: "1-888-216-3523", scope: "STATE", states: ["OK"], popularityScore: 78, tags: ["electric"] },
  { name: "Rhode Island Energy", slug: "ri-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas utility for Rhode Island (successor to National Grid RI)", website: "https://www.rienergy.com", phone: "1-855-743-1101", scope: "STATE", states: ["RI"], popularityScore: 90, tags: ["electric", "gas"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — WATER (2026-04-17)
  // ══════════════════════════════════════════════════════════
  { name: "Central Arkansas Water", slug: "central-ar-water", category: "UTILITY_WATER", description: "Little Rock and central Arkansas water start, stop, move, billing, and account support; confirm service availability by address", website: "https://carkw.com/customer-service/start-or-stop-service/", phone: "1-501-372-5161", scope: "STATE", states: ["AR"], zipCodes: AR_CENTRAL_WATER_ZIPS, popularityScore: 76, tags: ["water", "utility", "little-rock", "central-arkansas", "address-check"] },
  { name: "Aquarion Water Company of Connecticut", slug: "aquarion-ct", category: "UTILITY_WATER", description: "Connecticut water start, stop, property-transfer, tenant account, and service-availability support; confirm service by address", website: "https://www.aquarionwater.com/customer-care/start-or-stop-service", phone: "1-800-732-9678", scope: "STATE", states: ["CT"], popularityScore: 75, tags: ["water", "utility", "connecticut", "property-transfer", "address-check"] },
  { name: "Artesian Water Company", slug: "artesian-de", category: "UTILITY_WATER", description: "Water utility for Delaware", website: "https://www.artesianwater.com", phone: "1-302-453-6900", scope: "STATE", states: ["DE"], popularityScore: 72, tags: ["water"] },
  { name: "Suez Idaho (Veolia)", slug: "veolia-id", category: "UTILITY_WATER", description: "Water utility for Boise metro", website: "https://www.mywater.veolia.us", phone: "1-208-362-7300", scope: "STATE", states: ["ID"], popularityScore: 70, tags: ["water"] },
  { name: "WaterOne", slug: "waterone-ks", category: "UTILITY_WATER", description: "Water utility for Johnson County, Kansas", website: "https://www.waterone.org", phone: "1-913-895-1800", scope: "STATE", states: ["KS"], popularityScore: 72, tags: ["water"] },
  { name: "WSSC Water", slug: "wssc-md", category: "UTILITY_WATER", description: "Water and sewer start, stop, transfer, and account support for Montgomery and Prince George's counties; confirm service availability by address", website: "https://www.wsscwater.com/service", phone: "1-301-206-4001", scope: "STATE", states: ["MD"], zipCodes: MD_WSSC_ZIPS, popularityScore: 80, tags: ["water", "sewer", "utility", "montgomery-county", "prince-georges-county", "address-check"] },
  { name: "Boston Water and Sewer Commission", slug: "bwsc-ma", category: "UTILITY_WATER", description: "Boston water, sewer, stormwater, billing, and ownership-change support", website: "https://www.bwsc.org/residential-customers/services", phone: "1-617-989-7800", scope: "STATE", states: ["MA"], zipCodes: MA_BOSTON_ZIPS, popularityScore: 82, tags: ["water", "sewer", "stormwater", "utility", "boston", "address-check"] },
  { name: "Great Lakes Water Authority", slug: "glwa-mi", category: "UTILITY_WATER", description: "Regional water and sewer utility for Detroit metro", website: "https://www.glwater.org", phone: "1-844-455-4592", scope: "STATE", states: ["MI"], popularityScore: 78, tags: ["water"] },
  { name: "Minneapolis Water", slug: "minneapolis-water", category: "UTILITY_WATER", description: "Water utility for Minneapolis", website: "https://www2.minneapolismn.gov/government/departments/public-works/water", phone: "1-612-673-1114", scope: "STATE", states: ["MN"], popularityScore: 75, tags: ["water"] },
  { name: "Jackson Water", slug: "jackson-water-ms", category: "UTILITY_WATER", description: "Water utility for Jackson, MS", website: "https://www.jacksonms.gov/public-works", phone: "1-601-960-2723", scope: "STATE", states: ["MS"], popularityScore: 65, tags: ["water"] },
  { name: "City of Billings Water", slug: "billings-water-mt", category: "UTILITY_WATER", description: "Water utility for Billings, Montana", website: "https://ci.billings.mt.us/160/Public-Works", phone: "1-406-657-8310", scope: "STATE", states: ["MT"], popularityScore: 68, tags: ["water"] },
  { name: "Metropolitan Utilities District (Omaha)", slug: "mud-ne", category: "UTILITY_WATER", description: "Water and gas utility for Omaha, Nebraska", website: "https://www.mudomaha.com", phone: "1-402-554-6666", scope: "STATE", states: ["NE"], popularityScore: 80, tags: ["water", "gas"] },
  { name: "Pennichuck Water Works", slug: "pennichuck-nh", category: "UTILITY_WATER", description: "Southern New Hampshire water service transfer, property-transfer, and customer account support", website: "https://pennichuck.com/general-information-for-our-water-customers/new-customer-process/", phone: "1-800-553-5191", scope: "STATE", states: ["NH"], zipCodes: NH_PENNICHUCK_ZIPS, popularityScore: 74, tags: ["water", "utility", "southern-new-hampshire", "property-transfer", "address-check"] },
  { name: "Albuquerque Bernalillo County Water Utility", slug: "abcwua-nm", category: "UTILITY_WATER", description: "Water utility for Albuquerque metro", website: "https://www.abcwua.org", phone: "1-505-842-9287", scope: "STATE", states: ["NM"], popularityScore: 75, tags: ["water"] },
  { name: "Fargo Water", slug: "fargo-water-nd", category: "UTILITY_WATER", description: "Water utility for Fargo, North Dakota", website: "https://www.fargond.gov/city-government/departments/water", phone: "1-701-241-1324", scope: "STATE", states: ["ND"], popularityScore: 70, tags: ["water"] },
  { name: "Oklahoma City Utilities", slug: "okc-water", category: "UTILITY_WATER", description: "Water utility for Oklahoma City", website: "https://www.okc.gov/departments/utilities", phone: "1-405-297-2833", scope: "STATE", states: ["OK"], popularityScore: 74, tags: ["water"] },
  { name: "Tulsa Water", slug: "tulsa-water-ok", category: "UTILITY_WATER", description: "Water utility for Tulsa", website: "https://www.cityoftulsa.org/government/departments/water-and-sewer", phone: "1-918-596-9511", scope: "STATE", states: ["OK"], popularityScore: 72, tags: ["water"] },
  { name: "City of Portland Water Bureau", slug: "portland-water-or", category: "UTILITY_WATER", description: "Portland water, sewer, stormwater, start, stop, transfer, and utility account support; confirm service by address", website: "https://www.portland.gov/water/customer-service/pay-your-utility-bill/start-stop-or-transfer-service", phone: "1-503-823-7770", scope: "STATE", states: ["OR"], zipCodes: OR_PORTLAND_METRO_ZIPS, popularityScore: 80, tags: ["water", "sewer", "stormwater", "utility", "portland", "address-check"] },
  { name: "Providence Water", slug: "providence-water-ri", category: "UTILITY_WATER", description: "Water utility for Providence and most of Rhode Island", website: "https://www.provwater.com", phone: "1-401-521-6300", scope: "STATE", states: ["RI"], popularityScore: 76, tags: ["water"] },
  { name: "Charleston Water System", slug: "charleston-water-sc", category: "UTILITY_WATER", description: "Charleston-area water and sewer open-account, close-account, and customer-service support; confirm by address", website: "https://www.charlestonwater.com/180/Open-or-Close-an-Account", phone: "1-843-727-6800", scope: "STATE", states: ["SC"], zipCodes: SC_CHARLESTON_ZIPS, popularityScore: 80, tags: ["water", "sewer", "utility", "charleston", "address-check"] },
  { name: "Greenville Water", slug: "greenville-water", category: "UTILITY_WATER", description: "Greenville-area water start, stop, move, and customer account support; confirm service by address", website: "https://www.greenvillewater.com/customer-service/start-stop-move", scope: "STATE", states: ["SC"], zipCodes: SC_GREENVILLE_WATER_ZIPS, popularityScore: 78, tags: ["water", "utility", "greenville", "address-check"] },
  { name: "Columbia Water", slug: "columbia-water-sc", category: "UTILITY_WATER", description: "Columbia-area water and sewer new, transfer, stop, and customer account support; confirm service by address", website: "https://columbiascwater.net/new-transfer-service/", scope: "STATE", states: ["SC"], zipCodes: SC_COLUMBIA_WATER_ZIPS, popularityScore: 78, tags: ["water", "sewer", "utility", "columbia", "address-check"] },
  { name: "Spartanburg Water", slug: "spartanburg-water", category: "UTILITY_WATER", description: "Spartanburg-area water establish-service, disconnect-service, and customer support; confirm service by address", website: "https://www.spartanburgwater.org/manage-water-service", scope: "STATE", states: ["SC"], zipCodes: SC_SPARTANBURG_WATER_ZIPS, popularityScore: 74, tags: ["water", "utility", "spartanburg", "address-check"] },
  { name: "Beaufort-Jasper Water & Sewer Authority", slug: "beaufort-jasper-water", category: "UTILITY_WATER", description: "Beaufort and Jasper county water and sewer start, stop, and customer account support; confirm service by address", website: "https://www.bjwsa.org/167/StartStop-Services", scope: "STATE", states: ["SC"], zipCodes: SC_BEAUFORT_JASPER_WATER_ZIPS, popularityScore: 74, tags: ["water", "sewer", "utility", "lowcountry", "address-check"] },
  { name: "Grand Strand Water & Sewer Authority", slug: "grand-strand-water", category: "UTILITY_WATER", description: "Grand Strand and Horry-area water and sewer service application, discontinue-service, and account support; confirm service by address", website: "https://www.gswsa.com/customer-service.cfm?page=44", scope: "STATE", states: ["SC"], zipCodes: SC_GRAND_STRAND_WATER_ZIPS, popularityScore: 76, tags: ["water", "sewer", "utility", "grand-strand", "address-check"] },
  { name: "Mount Pleasant Waterworks", slug: "mount-pleasant-waterworks", category: "UTILITY_WATER", description: "Mount Pleasant water and sewer start, stop, transfer, and account-service support; confirm service by address", website: "https://www.mountpleasantwaterworks.com/customers/service___account_requests/start_or_stop_service.php", scope: "STATE", states: ["SC"], zipCodes: SC_MOUNT_PLEASANT_WATER_ZIPS, popularityScore: 72, tags: ["water", "sewer", "utility", "mount-pleasant", "address-check"] },
  { name: "Southern Connector / Palmetto Pass", slug: "palmetto-pass", category: "TRANSPORTATION_TOLL", description: "Greenville-area Southern Connector toll road and Palmetto Pass account, payment, vehicle, and customer-service support", website: "https://southernconnector.com/index.html", scope: "STATE", states: ["SC"], zipCodes: SC_SOUTHERN_CONNECTOR_ZIPS, popularityScore: 74, tags: ["toll", "palmetto-pass", "southern-connector", "greenville"] },
  { name: "Dominion Energy South Carolina", slug: "dominion-energy-sc", category: "UTILITY_ELECTRIC", description: "South Carolina electric start, stop, move, reconnect, and account support; confirm service availability by address", website: "https://www.dominionenergy.com/en/South-Carolina/Start-Stop-Service", phone: "1-800-251-7234", scope: "STATE", states: ["SC"], zipCodes: SC_DOMINION_ELECTRIC_ZIPS, popularityScore: 86, tags: ["electric", "utility", "south-carolina", "address-check"] },
  { name: "Duke Energy South Carolina", slug: "duke-energy-sc", category: "UTILITY_ELECTRIC", description: "South Carolina Duke Energy electric start, stop, move, and account support across Duke Energy Carolinas and Duke Energy Progress territories; confirm service by address", website: "https://www.duke-energy.com/start-stop-move/landing", phone: "1-800-777-9898", scope: "STATE", states: ["SC"], zipCodes: SC_DUKE_ZIPS, popularityScore: 84, tags: ["electric", "utility", "duke-energy", "address-check"] },
  { name: "Santee Cooper", slug: "santee-cooper", category: "UTILITY_ELECTRIC", description: "South Carolina public power and water start, move, stop, transfer, and customer account support; confirm service by address", website: "https://www.santeecooper.com/residential/start-move-stop-service/", phone: "1-800-804-7424", scope: "STATE", states: ["SC"], zipCodes: SC_SANTEE_COOPER_ZIPS, popularityScore: 82, tags: ["electric", "water", "utility", "public-power", "address-check"] },
  { name: "Berkeley Electric Cooperative", slug: "berkeley-electric", category: "UTILITY_ELECTRIC", description: "Lowcountry cooperative electric service, membership, and account setup support; confirm service by address", website: "https://www.berkeleyelectric.coop/service-territory", scope: "STATE", states: ["SC"], zipCodes: SC_BERKELEY_ELECTRIC_ZIPS, popularityScore: 76, tags: ["electric", "cooperative", "lowcountry", "address-check"] },
  { name: "Horry Electric Cooperative", slug: "horry-electric", category: "UTILITY_ELECTRIC", description: "Horry County and Myrtle Beach-area cooperative electric start, stop, and account support; confirm service by address", website: "https://horryelectric.com/services/electric-service/", scope: "STATE", states: ["SC"], zipCodes: SC_HORRY_ELECTRIC_ZIPS, popularityScore: 78, tags: ["electric", "cooperative", "horry", "myrtle-beach", "address-check"] },
  { name: "Blue Ridge Electric Cooperative", slug: "blue-ridge-electric-sc", category: "UTILITY_ELECTRIC", description: "Upstate South Carolina cooperative electric start-service and member account support; confirm service by address", website: "https://blueridge.coop/start-service", scope: "STATE", states: ["SC"], zipCodes: SC_BLUE_RIDGE_ELECTRIC_ZIPS, popularityScore: 72, tags: ["electric", "cooperative", "upstate", "address-check"] },
  { name: "Laurens Electric Cooperative", slug: "laurens-electric", category: "UTILITY_ELECTRIC", description: "Upstate cooperative electric start, stop, and account update support; confirm service by address", website: "https://laurenselectric.com/my-account/start-service/", scope: "STATE", states: ["SC"], zipCodes: SC_LAURENS_ELECTRIC_ZIPS, popularityScore: 72, tags: ["electric", "cooperative", "upstate", "address-check"] },
  { name: "Mid-Carolina Electric Cooperative", slug: "mid-carolina-electric", category: "UTILITY_ELECTRIC", description: "Midlands cooperative electric start-service and account-form support; confirm eligibility by address", website: "https://www.mcecoop.com/my-account/start-service/", scope: "STATE", states: ["SC"], zipCodes: SC_MID_CAROLINA_ELECTRIC_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "midlands", "address-check"] },
  { name: "Palmetto Electric Cooperative", slug: "palmetto-electric", category: "UTILITY_ELECTRIC", description: "Lowcountry cooperative electric membership, start-service, and stop-service support; confirm service by address", website: "https://palmetto.coop/startstop-service", scope: "STATE", states: ["SC"], zipCodes: SC_PALMETTO_ELECTRIC_ZIPS, popularityScore: 72, tags: ["electric", "cooperative", "lowcountry", "address-check"] },
  { name: "York Electric Cooperative", slug: "york-electric", category: "UTILITY_ELECTRIC", description: "York, Lancaster, Chester, and Cherokee-area cooperative electric start and stop residential service support; confirm service by address", website: "https://www.yorkelectric.net/my-service/residential-accounts/start-residential-electric-service/", scope: "STATE", states: ["SC"], zipCodes: SC_YORK_ELECTRIC_ZIPS, popularityScore: 74, tags: ["electric", "cooperative", "york", "address-check"] },
  { name: "Santee Electric Cooperative", slug: "santee-electric", category: "UTILITY_ELECTRIC", description: "Regional South Carolina cooperative electric connect, disconnect, and account-service support; confirm service by address", website: "https://santee.org/service", scope: "STATE", states: ["SC"], zipCodes: SC_SANTEE_ELECTRIC_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "address-check"] },
  { name: "Sioux Falls Water", slug: "sioux-falls-water-sd", category: "UTILITY_WATER", description: "Water utility for Sioux Falls, South Dakota", website: "https://www.siouxfalls.org/public-works/water", phone: "1-605-367-8131", scope: "STATE", states: ["SD"], popularityScore: 70, tags: ["water"] },
  { name: "Salt Lake City Department of Public Utilities", slug: "slc-water-ut", category: "UTILITY_WATER", description: "Salt Lake City water, sewer, stormwater, street lighting, utility billing, and service support", website: "https://www.slc.gov/utilities/", phone: "1-801-483-6900", scope: "STATE", states: ["UT"], zipCodes: UT_SLC_PUBLIC_UTILITIES_ZIPS, popularityScore: 78, tags: ["water", "sewer", "stormwater", "utility", "salt-lake-city", "address-check"] },
  { name: "Burlington Department of Public Works Water", slug: "burlington-water-vt", category: "UTILITY_WATER", description: "Water utility for Burlington, Vermont", website: "https://www.burlingtonvt.gov/DPW/Water", phone: "1-802-863-4501", scope: "STATE", states: ["VT"], popularityScore: 68, tags: ["water"] },
  { name: "Seattle Public Utilities", slug: "spu-wa", category: "UTILITY_WATER", description: "Seattle water, sewer, drainage, garbage, recycling, and food/yard waste account support", website: "https://www.seattle.gov/utilities/your-services/accounts-and-payments/start-or-stop-services", phone: "1-206-684-3000", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["water", "sewer", "trash", "recycling", "utility", "seattle", "address-check"] },
  { name: "Cheyenne Board of Public Utilities", slug: "cheyenne-bopu-wy", category: "UTILITY_WATER", description: "Water utility for Cheyenne, Wyoming", website: "https://www.cheyennebopu.org", phone: "1-307-637-6460", scope: "STATE", states: ["WY"], popularityScore: 68, tags: ["water"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — GAS (2026-04-17)
  // ══════════════════════════════════════════════════════════
  { name: "ENSTAR Natural Gas", slug: "enstar-ak", category: "UTILITY_GAS", description: "Natural gas utility for Anchorage and south-central Alaska", website: "https://www.enstarnaturalgas.com", phone: "1-907-277-5551", scope: "STATE", states: ["AK"], popularityScore: 80, tags: ["gas"] },
  { name: "Summit Utilities Arkansas", slug: "summit-utilities-ar", category: "UTILITY_GAS", description: "Arkansas natural gas start, stop, transfer, and account support; formerly CenterPoint/Arkla service areas, confirm by address", website: "https://summitutilities.com/contact/start-stop-transfer-service", phone: "1-800-992-7552", scope: "STATE", states: ["AR"], zipCodes: AR_SUMMIT_GAS_ZIPS, popularityScore: 82, tags: ["gas", "utility", "summit", "centerpoint", "arkla", "address-check"] },
  { name: "Black Hills Energy Arkansas", slug: "black-hills-energy-ar", category: "UTILITY_GAS", description: "Arkansas natural gas start, stop, transfer, and account support for Black Hills Energy service communities; confirm by address", website: "https://www.blackhillsenergy.com/app-startstop/service-select", phone: "1-888-890-5554", scope: "STATE", states: ["AR"], zipCodes: AR_BLACK_HILLS_GAS_ZIPS, popularityScore: 76, tags: ["gas", "utility", "black-hills", "arkansas-western-gas", "address-check"] },
  { name: "Carroll Electric Cooperative Corporation", slug: "carroll-electric-ar", category: "UTILITY_ELECTRIC", description: "Northwest Arkansas cooperative electric connect, transfer, account, and member service support; confirm service availability by address", website: "https://www.carrollecc.com/apply-for-service", scope: "STATE", states: ["AR"], zipCodes: AR_CARROLL_ELECTRIC_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "northwest-arkansas", "address-check"] },
  { name: "First Electric Cooperative Corporation", slug: "first-electric-ar", category: "UTILITY_ELECTRIC", description: "Central and southeast Arkansas cooperative electric setup and account support; confirm service availability by address", website: "https://www.firstelectric.coop/services/electrical-service/set-up-new-service", scope: "STATE", states: ["AR"], zipCodes: AR_FIRST_ELECTRIC_ZIPS, popularityScore: 70, tags: ["electric", "cooperative", "central-arkansas", "southeast-arkansas", "address-check"] },
  { name: "Black Hills Energy Colorado", slug: "bhe-co-gas", category: "UTILITY_GAS", description: "Colorado natural gas and electric start, stop, transfer, and account support; confirm service availability by address", website: "https://www.blackhillsenergy.com/app-startstop/service-select", phone: "1-888-890-5554", scope: "STATE", states: ["CO"], zipCodes: CO_BLACK_HILLS_ZIPS, popularityScore: 70, tags: ["gas", "electric", "utility", "colorado", "address-check"] },
  { name: "Southern Connecticut Gas Company", slug: "socogas-ct", category: "UTILITY_GAS", description: "Southern Connecticut natural gas start, stop, transfer, locator, and customer account support; confirm gas availability by address", website: "https://www.soconngas.com/moving", phone: "1-877-944-6427", scope: "STATE", states: ["CT"], popularityScore: 74, tags: ["gas", "utility", "southern-connecticut", "start-stop-service", "address-check"] },
  { name: "Chesapeake Utilities", slug: "chpk-de-gas", category: "UTILITY_GAS", description: "Natural gas start, stop, transfer, and account support for Delaware and Maryland Eastern Shore service areas", website: "https://www.chpkgas.com/customer-care/manage-my-account/start-stop-transfer-service/", phone: "1-800-427-2883", scope: "STATE", states: ["DE", "MD"], zipCodes: ["197", "198", "199", "216", "218", "219"], popularityScore: 72, tags: ["gas", "utility", "delaware", "maryland", "eastern-shore", "address-check"] },
  { name: "Hawaii Gas", slug: "hawaii-gas", category: "UTILITY_GAS", description: "Gas utility account support across Hawaii islands; confirm service availability by exact address", website: "https://www.hawaiigas.com/contact-us", phone: "1-808-535-5933", scope: "STATE", states: ["HI"], popularityScore: 75, tags: ["gas", "utility", "address-check"] },
  { name: "Intermountain Gas", slug: "intgas-id", category: "UTILITY_GAS", description: "Natural gas utility for Idaho", website: "https://www.intgas.com", phone: "1-800-548-3679", scope: "STATE", states: ["ID"], popularityScore: 78, tags: ["gas"] },
  { name: "Black Hills Energy Iowa", slug: "bhe-ia-gas", category: "UTILITY_GAS", description: "Natural gas utility for Iowa", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["gas"] },
  { name: "Kansas Gas Service", slug: "kgs-ks", category: "UTILITY_GAS", description: "Natural gas utility for Kansas (ONE Gas)", website: "https://www.kansasgasservice.com", phone: "1-800-794-4780", scope: "STATE", states: ["KS"], popularityScore: 80, tags: ["gas"] },
  { name: "Atmos Energy Louisiana", slug: "atmos-la", category: "UTILITY_GAS", description: "Natural gas utility for Louisiana", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["LA"], popularityScore: 72, tags: ["gas"] },
  { name: "Summit Natural Gas of Maine", slug: "summit-me", category: "UTILITY_GAS", description: "Natural gas utility for central Maine", website: "https://www.summitnaturalgas.com", phone: "1-855-923-9432", scope: "STATE", states: ["ME"], popularityScore: 65, tags: ["gas"] },
  { name: "CenterPoint Energy Minnesota", slug: "centerpoint-mn", category: "UTILITY_GAS", description: "Natural gas utility for Minnesota", website: "https://www.centerpointenergy.com/minnesota", phone: "1-800-245-2377", scope: "STATE", states: ["MN"], popularityScore: 82, tags: ["gas"] },
  { name: "Atmos Energy Mississippi", slug: "atmos-ms", category: "UTILITY_GAS", description: "Natural gas utility for Mississippi", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["MS"], popularityScore: 70, tags: ["gas"] },
  { name: "NorthWestern Energy", slug: "nwe-mt", category: "UTILITY_GAS", description: "Natural gas and electric utility for Montana and SD/NE", website: "https://www.northwesternenergy.com", phone: "1-888-467-2669", scope: "STATE", states: ["MT", "SD", "NE"], popularityScore: 82, tags: ["gas", "electric"] },
  { name: "Black Hills Energy Nebraska", slug: "bhe-ne-gas", category: "UTILITY_GAS", description: "Natural gas utility for Nebraska", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["NE"], popularityScore: 70, tags: ["gas"] },
  { name: "Unitil Northern Utilities New Hampshire Gas", slug: "unitil-nh", category: "UTILITY_GAS", description: "New Hampshire natural gas utility account support; confirm service availability by address", website: "https://unitil.com/account-billing/start-stop-or-move-service", phone: "1-888-301-7700", scope: "STATE", states: ["NH"], zipCodes: NH_UNITIL_GAS_ZIPS, popularityScore: 72, tags: ["gas", "utility", "new-hampshire", "unitil", "address-check"] },
  { name: "New Mexico Gas Company", slug: "nmgas", category: "UTILITY_GAS", description: "Natural gas utility for New Mexico", website: "https://www.nmgco.com", phone: "1-888-664-2726", scope: "STATE", states: ["NM"], popularityScore: 80, tags: ["gas"] },
  { name: "Xcel Energy North Dakota Gas", slug: "xcel-nd-gas", category: "UTILITY_GAS", description: "Natural gas utility for eastern North Dakota", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["ND"], popularityScore: 78, tags: ["gas"] },
  { name: "Oklahoma Natural Gas (ONE Gas)", slug: "ong-ok", category: "UTILITY_GAS", description: "Natural gas utility for Oklahoma", website: "https://www.oklahomanaturalgas.com", phone: "1-800-664-5463", scope: "STATE", states: ["OK"], popularityScore: 85, tags: ["gas"] },
  { name: "Dominion Energy South Carolina Gas", slug: "dominion-sc-gas", category: "UTILITY_GAS", description: "South Carolina natural gas start, stop, move, and availability-check support; confirm service by address", website: "https://www.dominionenergy.com/en/South-Carolina/Start-Stop-Service/Check-Availability", phone: "1-800-251-7234", scope: "STATE", states: ["SC"], zipCodes: SC_DOMINION_GAS_ZIPS, popularityScore: 80, tags: ["gas", "utility", "south-carolina", "address-check"] },
  { name: "York County Natural Gas Authority", slug: "york-county-natural-gas", category: "UTILITY_GAS", description: "York County and nearby natural gas start, stop, change-service, and account support; confirm service by address", website: "https://ycnga.com/start-stop-change-service/", scope: "STATE", states: ["SC"], zipCodes: SC_YORK_LANCASTER_ZIPS, popularityScore: 72, tags: ["gas", "utility", "york", "address-check"] },
  { name: "Fort Hill Natural Gas Authority", slug: "fort-hill-natural-gas", category: "UTILITY_GAS", description: "Oconee, Pickens, and Anderson-area natural gas start, stop, transfer, and new-customer support; confirm service by address", website: "https://www.fhnga.com/customer-support/start-stop-transfer.stml", scope: "STATE", states: ["SC"], zipCodes: SC_UPSTATE_ZIPS, popularityScore: 70, tags: ["gas", "utility", "upstate", "address-check"] },
  { name: "Lancaster County Natural Gas Authority", slug: "lancaster-county-natural-gas", category: "UTILITY_GAS", description: "Lancaster County natural gas application, account, and customer-service support; confirm service by address", website: "https://lcngasc.com/", scope: "STATE", states: ["SC"], zipCodes: SC_YORK_LANCASTER_ZIPS, popularityScore: 68, tags: ["gas", "utility", "lancaster", "address-check"] },
  { name: "MDU Resources South Dakota Gas", slug: "mdu-sd-gas", category: "UTILITY_GAS", description: "Natural gas utility for South Dakota", website: "https://www.montana-dakota.com", phone: "1-800-638-3278", scope: "STATE", states: ["SD"], popularityScore: 76, tags: ["gas"] },
  { name: "Piedmont Natural Gas Tennessee", slug: "piedmont-tn", category: "UTILITY_GAS", description: "Natural gas utility for Tennessee", website: "https://www.piedmontng.com/home/start-stop-or-move", phone: "1-800-752-7504", scope: "STATE", states: ["TN"], popularityScore: 80, tags: ["gas", "utility", "tennessee", "address-check"] },
  { name: "Enbridge Gas Utah", slug: "dominion-ut-gas", category: "UTILITY_GAS", description: "Natural gas start, stop, move, and account support in Utah, Idaho, and Wyoming; formerly Dominion Energy Utah and Questar Gas", website: "https://www.enbridgegas.com/utwyid/start-stop-service", phone: "1-800-323-5517", scope: "STATE", states: ["UT", "WY", "ID"], popularityScore: 86, tags: ["gas", "utility", "enbridge", "dominion-energy-utah", "questar-gas", "address-check"] },
  { name: "Cascade Natural Gas", slug: "cascade-wa-gas", category: "UTILITY_GAS", description: "Washington and Oregon natural gas start, stop, transfer, and account support; confirm service availability by address", website: "https://www.cngc.com/customer-service/start-stop-or-transfer-service/", phone: "1-888-522-1130", scope: "STATE", states: ["WA", "OR"], zipCodes: PNW_CASCADE_GAS_ZIPS, popularityScore: 75, tags: ["gas", "utility", "washington", "oregon", "address-check"] },
  { name: "Mountaineer Gas", slug: "mountaineer-wv", category: "UTILITY_GAS", description: "Natural gas utility for West Virginia", website: "https://www.mountaineergas.com", phone: "1-800-834-2070", scope: "STATE", states: ["WV"], popularityScore: 76, tags: ["gas"] },
  { name: "Wisconsin Public Service Gas", slug: "wps-wi-gas", category: "UTILITY_GAS", description: "Natural gas utility for northeast and central Wisconsin", website: "https://www.wisconsinpublicservice.com", phone: "1-800-450-7260", scope: "STATE", states: ["WI"], popularityScore: 76, tags: ["gas"] },
  { name: "Source Gas Distribution Wyoming", slug: "source-gas-wy", category: "UTILITY_GAS", description: "Natural gas utility for Wyoming (Black Hills Energy)", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["WY"], popularityScore: 72, tags: ["gas"] },
  { name: "Rhode Island Energy Gas", slug: "ri-energy-gas", category: "UTILITY_GAS", description: "Natural gas utility for Rhode Island (successor to National Grid RI)", website: "https://www.rienergy.com", phone: "1-855-743-1101", scope: "STATE", states: ["RI"], popularityScore: 86, tags: ["gas"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: GOVERNMENT_VOTER — STATE REGISTRATION PORTALS (50 states)
  // Each state's Secretary of State (or equivalent) voter portal.
  // ══════════════════════════════════════════════════════════
  { name: "Alabama Secretary of State — Voter", slug: "vote-al", category: "GOVERNMENT_VOTER", description: "Alabama voter registration and elections", website: "https://www.sos.alabama.gov/alabama-votes", phone: "1-334-242-7210", scope: "STATE", states: ["AL"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Alaska Division of Elections", slug: "vote-ak", category: "GOVERNMENT_VOTER", description: "Alaska voter registration and elections", website: "https://www.elections.alaska.gov", phone: "1-907-465-4611", scope: "STATE", states: ["AK"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Arizona Voter Registration", slug: "vote-az", category: "GOVERNMENT_VOTER", description: "Arizona voter registration (Service Arizona / EZVoter)", website: "https://servicearizona.com/voterRegistration", phone: "1-602-542-4285", scope: "STATE", states: ["AZ"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Arkansas Secretary of State — Voter", slug: "vote-ar", category: "GOVERNMENT_VOTER", description: "Arkansas voter registration and elections", website: "https://www.sos.arkansas.gov/elections", phone: "1-501-682-5070", scope: "STATE", states: ["AR"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "California Secretary of State — Voter", slug: "vote-ca", category: "GOVERNMENT_VOTER", description: "California voter registration (registertovote.ca.gov)", website: "https://registertovote.ca.gov", phone: "1-800-345-8683", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["voter", "government", "essential"] },
  { name: "Colorado Secretary of State — Voter", slug: "vote-co", category: "GOVERNMENT_VOTER", description: "Colorado voter registration (GoVoteColorado)", website: "https://www.sos.state.co.us/voter", phone: "1-303-894-2200", scope: "STATE", states: ["CO"], popularityScore: 78, tags: ["voter", "government", "essential"] },
  { name: "Connecticut Secretary of State — Voter", slug: "vote-ct", category: "GOVERNMENT_VOTER", description: "Connecticut voter registration and elections", website: "https://portal.ct.gov/sots/election-services/elections", phone: "1-860-509-6200", scope: "STATE", states: ["CT"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Delaware Department of Elections", slug: "vote-de", category: "GOVERNMENT_VOTER", description: "Delaware voter registration and elections", website: "https://elections.delaware.gov", phone: "1-302-739-4277", scope: "STATE", states: ["DE"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "DC Board of Elections", slug: "vote-dc", category: "GOVERNMENT_VOTER", description: "DC voter registration and elections", website: "https://www.dcboe.org", phone: "1-202-727-2525", scope: "STATE", states: ["DC"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Florida Division of Elections", slug: "vote-fl", category: "GOVERNMENT_VOTER", description: "Florida voter registration (RegisterToVoteFlorida.gov)", website: "https://registertovoteflorida.gov", phone: "1-866-308-6739", scope: "STATE", states: ["FL"], popularityScore: 80, tags: ["voter", "government", "essential"] },
  { name: "Georgia My Voter Page", slug: "vote-ga", category: "GOVERNMENT_VOTER", description: "Georgia voter registration and My Voter Page", website: "https://mvp.sos.ga.gov", phone: "1-404-656-2871", scope: "STATE", states: ["GA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Hawaii Office of Elections", slug: "vote-hi", category: "GOVERNMENT_VOTER", description: "Hawaii voter registration and elections", website: "https://elections.hawaii.gov", phone: "1-808-453-8683", scope: "STATE", states: ["HI"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Idaho Secretary of State — Voter", slug: "vote-id", category: "GOVERNMENT_VOTER", description: "Idaho voter registration and elections", website: "https://elections.sos.idaho.gov", phone: "1-208-334-2852", scope: "STATE", states: ["ID"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Illinois State Board of Elections", slug: "vote-il", category: "GOVERNMENT_VOTER", description: "Illinois voter registration (Online Voter Application)", website: "https://ova.elections.il.gov", phone: "1-217-782-4141", scope: "STATE", states: ["IL"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Indiana Voter Portal", slug: "vote-in", category: "GOVERNMENT_VOTER", description: "Indiana voter registration (IndianaVoters.com)", website: "https://indianavoters.in.gov", phone: "1-317-232-3939", scope: "STATE", states: ["IN"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Iowa Secretary of State — Voter", slug: "vote-ia", category: "GOVERNMENT_VOTER", description: "Iowa voter registration and elections", website: "https://sos.iowa.gov/elections", phone: "1-515-281-5204", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Kansas Secretary of State — Voter", slug: "vote-ks", category: "GOVERNMENT_VOTER", description: "Kansas voter registration (VoteKansas.gov)", website: "https://www.sos.ks.gov/elections/elections.html", phone: "1-785-296-4561", scope: "STATE", states: ["KS"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Kentucky State Board of Elections", slug: "vote-ky", category: "GOVERNMENT_VOTER", description: "Kentucky voter registration (GoVoteKY.com)", website: "https://vrsws.sos.ky.gov/ovrweb", phone: "1-502-573-7100", scope: "STATE", states: ["KY"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Louisiana Secretary of State — Voter", slug: "vote-la", category: "GOVERNMENT_VOTER", description: "Louisiana voter registration (GeauxVote)", website: "https://voterportal.sos.la.gov", phone: "1-225-922-0900", scope: "STATE", states: ["LA"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Maine Secretary of State — Voter", slug: "vote-me", category: "GOVERNMENT_VOTER", description: "Maine voter registration and elections", website: "https://www.maine.gov/sos/cec/elec/voter-info", phone: "1-207-624-7650", scope: "STATE", states: ["ME"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Maryland State Board of Elections", slug: "vote-md", category: "GOVERNMENT_VOTER", description: "Maryland voter registration and elections", website: "https://elections.maryland.gov", phone: "1-800-222-8683", scope: "STATE", states: ["MD"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Massachusetts Elections Division", slug: "vote-ma", category: "GOVERNMENT_VOTER", description: "Massachusetts voter registration (RegisterToVoteMA)", website: "https://www.sec.state.ma.us/divisions/elections", phone: "1-617-727-2828", scope: "STATE", states: ["MA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Michigan Voter Information Center", slug: "vote-mi", category: "GOVERNMENT_VOTER", description: "Michigan voter registration (MVIC)", website: "https://mvic.sos.state.mi.us", phone: "1-517-335-3234", scope: "STATE", states: ["MI"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Minnesota Secretary of State — Voter", slug: "vote-mn", category: "GOVERNMENT_VOTER", description: "Minnesota voter registration and elections", website: "https://mnvotes.sos.mn.gov", phone: "1-651-215-1440", scope: "STATE", states: ["MN"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Mississippi Secretary of State — Voter", slug: "vote-ms", category: "GOVERNMENT_VOTER", description: "Mississippi voter registration and elections", website: "https://www.sos.ms.gov/elections-voting", phone: "1-601-359-1350", scope: "STATE", states: ["MS"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Missouri Secretary of State — Voter", slug: "vote-mo", category: "GOVERNMENT_VOTER", description: "Missouri voter registration and elections", website: "https://www.sos.mo.gov/elections", phone: "1-573-751-2301", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Montana Secretary of State — Voter", slug: "vote-mt", category: "GOVERNMENT_VOTER", description: "Montana voter registration and elections", website: "https://sosmt.gov/elections", phone: "1-406-444-9608", scope: "STATE", states: ["MT"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Nebraska Secretary of State — Voter", slug: "vote-ne", category: "GOVERNMENT_VOTER", description: "Nebraska voter registration and elections", website: "https://sos.nebraska.gov/elections", phone: "1-402-471-2555", scope: "STATE", states: ["NE"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Nevada Secretary of State — Voter", slug: "vote-nv", category: "GOVERNMENT_VOTER", description: "Nevada voter registration and elections (RegisterToVoteNV)", website: "https://www.nvsos.gov/sos/elections", phone: "1-775-684-5705", scope: "STATE", states: ["NV"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "New Hampshire Secretary of State — Voter", slug: "vote-nh", category: "GOVERNMENT_VOTER", description: "New Hampshire voter registration and elections", website: "https://www.sos.nh.gov/elections", phone: "1-603-271-3242", scope: "STATE", states: ["NH"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "New Jersey Voter Registration", slug: "vote-nj", category: "GOVERNMENT_VOTER", description: "New Jersey voter registration (Vote.NJ.gov)", website: "https://www.vote.nj.gov", phone: "1-877-658-6837", scope: "STATE", states: ["NJ"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "New Mexico Secretary of State — Voter", slug: "vote-nm", category: "GOVERNMENT_VOTER", description: "New Mexico voter registration and elections", website: "https://www.sos.state.nm.us/voting-and-elections", phone: "1-800-477-3632", scope: "STATE", states: ["NM"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "New York State Board of Elections", slug: "vote-ny", category: "GOVERNMENT_VOTER", description: "New York voter registration (voterlookup.elections.ny.gov)", website: "https://elections.ny.gov", phone: "1-518-474-8100", scope: "STATE", states: ["NY"], popularityScore: 80, tags: ["voter", "government", "essential"] },
  { name: "North Carolina State Board of Elections", slug: "vote-nc", category: "GOVERNMENT_VOTER", description: "North Carolina voter registration and elections", website: "https://www.ncsbe.gov", phone: "1-919-814-0700", scope: "STATE", states: ["NC"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "North Dakota Secretary of State — Voter", slug: "vote-nd", category: "GOVERNMENT_VOTER", description: "North Dakota voter information (no registration required)", website: "https://vip.sos.nd.gov", phone: "1-701-328-2900", scope: "STATE", states: ["ND"], popularityScore: 65, tags: ["voter", "government", "essential"] },
  { name: "Ohio Secretary of State — Voter", slug: "vote-oh", category: "GOVERNMENT_VOTER", description: "Ohio voter registration (OhioSoS.gov)", website: "https://www.ohiosos.gov/elections/voters", phone: "1-877-767-6446", scope: "STATE", states: ["OH"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Oklahoma State Election Board", slug: "vote-ok", category: "GOVERNMENT_VOTER", description: "Oklahoma voter registration and elections", website: "https://oklahoma.gov/elections", phone: "1-405-521-2391", scope: "STATE", states: ["OK"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Oregon Secretary of State — Voter", slug: "vote-or", category: "GOVERNMENT_VOTER", description: "Oregon voter registration (OregonVotes)", website: "https://sos.oregon.gov/voting/Pages/default.aspx", phone: "1-866-673-8683", scope: "STATE", states: ["OR"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Pennsylvania Department of State — Voter", slug: "vote-pa", category: "GOVERNMENT_VOTER", description: "Pennsylvania voter registration (VotesPA)", website: "https://www.vote.pa.gov", phone: "1-877-868-3772", scope: "STATE", states: ["PA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Rhode Island Secretary of State — Voter", slug: "vote-ri", category: "GOVERNMENT_VOTER", description: "Rhode Island voter registration and elections", website: "https://vote.sos.ri.gov", phone: "1-401-222-2345", scope: "STATE", states: ["RI"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "South Carolina Election Commission", slug: "vote-sc", category: "GOVERNMENT_VOTER", description: "South Carolina voter registration (scVOTES)", website: "https://www.scvotes.gov", phone: "1-803-734-9060", scope: "STATE", states: ["SC"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "South Dakota Secretary of State — Voter", slug: "vote-sd", category: "GOVERNMENT_VOTER", description: "South Dakota voter registration and elections", website: "https://sdsos.gov/elections-voting", phone: "1-605-773-3537", scope: "STATE", states: ["SD"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Tennessee Secretary of State — Voter", slug: "vote-tn", category: "GOVERNMENT_VOTER", description: "Tennessee voter registration (GoVoteTN)", website: "https://sos.tn.gov/elections", phone: "1-877-850-4959", scope: "STATE", states: ["TN"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Texas Voter Registration", slug: "vote-tx", category: "GOVERNMENT_VOTER", description: "Texas voter registration and election info (VoteTexas.gov)", website: "https://www.votetexas.gov", phone: "1-800-252-8683", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["voter", "government", "essential"] },
  { name: "Utah Voter Registration", slug: "vote-ut", category: "GOVERNMENT_VOTER", description: "Utah voter registration (Vote.Utah.gov)", website: "https://vote.utah.gov", phone: "1-801-538-1041", scope: "STATE", states: ["UT"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Vermont Secretary of State — Voter", slug: "vote-vt", category: "GOVERNMENT_VOTER", description: "Vermont voter registration and elections", website: "https://sos.vermont.gov/elections", phone: "1-802-828-2363", scope: "STATE", states: ["VT"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Virginia Department of Elections", slug: "vote-va", category: "GOVERNMENT_VOTER", description: "Virginia voter registration (elections.virginia.gov)", website: "https://www.elections.virginia.gov", phone: "1-800-552-9745", scope: "STATE", states: ["VA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Washington Secretary of State — Voter", slug: "vote-wa", category: "GOVERNMENT_VOTER", description: "Washington voter registration (VoteWA.gov)", website: "https://voter.votewa.gov", phone: "1-800-448-4881", scope: "STATE", states: ["WA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "West Virginia Secretary of State — Voter", slug: "vote-wv", category: "GOVERNMENT_VOTER", description: "West Virginia voter registration (GoVoteWV)", website: "https://ovr.sos.wv.gov", phone: "1-304-558-6000", scope: "STATE", states: ["WV"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Wisconsin Elections Commission", slug: "vote-wi", category: "GOVERNMENT_VOTER", description: "Wisconsin voter registration (MyVote.wi.gov)", website: "https://myvote.wi.gov", phone: "1-608-266-8005", scope: "STATE", states: ["WI"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Wyoming Secretary of State — Voter", slug: "vote-wy", category: "GOVERNMENT_VOTER", description: "Wyoming voter registration and elections", website: "https://sos.wyo.gov/elections", phone: "1-307-777-5860", scope: "STATE", states: ["WY"], popularityScore: 66, tags: ["voter", "government", "essential"] },

  // ── Renters Insurance (FINANCIAL_INSURANCE_RENTERS) ──
  { name: "Lemonade Renters", slug: "lemonade-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "AI-powered renters insurance starting at $5/mo", website: "https://www.lemonade.com/renters-insurance", phone: "1-844-733-8666", scope: "FEDERAL", popularityScore: 82, tags: ["renters", "insurance", "rental"] },
  { name: "State Farm Renters", slug: "state-farm-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from State Farm", website: "https://www.statefarm.com/insurance/home-and-property/renters", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 85, tags: ["renters", "insurance"] },
  { name: "Allstate Renters", slug: "allstate-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters coverage from Allstate", website: "https://www.allstate.com/renters-insurance", phone: "1-800-255-7828", scope: "FEDERAL", popularityScore: 80, tags: ["renters", "insurance"] },
  { name: "Geico Renters", slug: "geico-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Geico", website: "https://www.geico.com/renters-insurance", phone: "1-800-841-3000", scope: "FEDERAL", popularityScore: 78, tags: ["renters", "insurance"] },
  { name: "Progressive Renters", slug: "progressive-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Progressive", website: "https://www.progressive.com/renters", phone: "1-866-749-7436", scope: "FEDERAL", popularityScore: 76, tags: ["renters", "insurance"] },
  { name: "Liberty Mutual Renters", slug: "liberty-mutual-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Liberty Mutual", website: "https://www.libertymutual.com/renters-insurance", phone: "1-800-290-8711", scope: "FEDERAL", popularityScore: 72, tags: ["renters", "insurance"] },
  { name: "USAA Renters", slug: "usaa-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance for military families", website: "https://www.usaa.com/inet/wc/insurance-renters-product", phone: "1-800-531-8722", scope: "FEDERAL", popularityScore: 75, tags: ["renters", "insurance", "military"] },
  { name: "Assurant Renters", slug: "assurant-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance commonly offered via apartment communities", website: "https://www.assurant.com/renters-insurance", phone: "1-888-260-7736", scope: "FEDERAL", popularityScore: 60, tags: ["renters", "insurance", "apartment"] },
  { name: "Toggle Renters", slug: "toggle-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Customizable renters insurance by Farmers", website: "https://gettoggle.com", scope: "FEDERAL", popularityScore: 58, tags: ["renters", "insurance"] },
  { name: "Jetty Renters", slug: "jetty-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance built for apartment dwellers", website: "https://www.jetty.com/renters-insurance", scope: "FEDERAL", popularityScore: 55, tags: ["renters", "insurance", "apartment"] },

  // ── Payment Apps / Fintech (FINANCIAL_FINTECH) ──
  { name: "Venmo", slug: "venmo", category: "FINANCIAL_FINTECH", description: "Send and receive money with friends", website: "https://venmo.com", scope: "FEDERAL", popularityScore: 92, tags: ["payments", "p2p", "fintech"] },
  { name: "PayPal", slug: "paypal", category: "FINANCIAL_FINTECH", description: "Digital payments and money transfers", website: "https://www.paypal.com", phone: "1-888-221-1161", scope: "FEDERAL", popularityScore: 90, tags: ["payments", "fintech"] },
  { name: "Zelle", slug: "zelle", category: "FINANCIAL_FINTECH", description: "Bank-backed instant money transfers", website: "https://www.zellepay.com", scope: "FEDERAL", popularityScore: 88, tags: ["payments", "p2p", "banking"] },
  { name: "Cash App", slug: "cash-app", category: "FINANCIAL_FINTECH", description: "Peer-to-peer payments, banking, and investing", website: "https://cash.app", scope: "FEDERAL", popularityScore: 87, tags: ["payments", "p2p", "banking"] },
  { name: "Apple Pay", slug: "apple-pay", category: "FINANCIAL_FINTECH", description: "Contactless payments from iPhone and Apple Watch", website: "https://www.apple.com/apple-pay", scope: "FEDERAL", popularityScore: 85, tags: ["payments", "contactless"] },
  { name: "Google Pay", slug: "google-pay", category: "FINANCIAL_FINTECH", description: "Contactless payments from Android devices", website: "https://pay.google.com", scope: "FEDERAL", popularityScore: 78, tags: ["payments", "contactless"] },
  { name: "Chime", slug: "chime", category: "FINANCIAL_FINTECH", description: "Fee-free mobile banking", website: "https://www.chime.com", phone: "1-844-244-6363", scope: "FEDERAL", popularityScore: 82, tags: ["banking", "fintech"] },
  { name: "Wise", slug: "wise", category: "FINANCIAL_FINTECH", description: "International money transfers at real exchange rates", website: "https://wise.com", scope: "FEDERAL", popularityScore: 72, tags: ["payments", "international", "fintech"] },
  { name: "Current", slug: "current", category: "FINANCIAL_FINTECH", description: "Mobile banking with early paycheck access", website: "https://current.com", scope: "FEDERAL", popularityScore: 62, tags: ["banking", "fintech"] },
  { name: "Varo Bank", slug: "varo", category: "FINANCIAL_FINTECH", description: "All-mobile bank with no monthly fees", website: "https://www.varomoney.com", phone: "1-877-377-8276", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "fintech"] },

  // ── Telemedicine (HEALTHCARE_TELEMEDICINE) ──
  { name: "MDLive", slug: "mdlive", category: "HEALTHCARE_TELEMEDICINE", description: "24/7 virtual doctor visits", website: "https://www.mdlive.com", phone: "1-888-632-2738", scope: "FEDERAL", popularityScore: 75, tags: ["telemedicine", "virtual", "health"] },
  { name: "Amwell", slug: "amwell", category: "HEALTHCARE_TELEMEDICINE", description: "Online doctor visits via video", website: "https://amwell.com", phone: "1-844-733-3627", scope: "FEDERAL", popularityScore: 72, tags: ["telemedicine", "virtual", "health"] },
  { name: "Doctor on Demand", slug: "doctor-on-demand", category: "HEALTHCARE_TELEMEDICINE", description: "Virtual urgent, primary, and mental health care", website: "https://doctorondemand.com", phone: "1-800-997-6196", scope: "FEDERAL", popularityScore: 70, tags: ["telemedicine", "virtual", "health"] },
  { name: "K Health", slug: "k-health", category: "HEALTHCARE_TELEMEDICINE", description: "AI-assisted primary care via mobile", website: "https://khealth.com", scope: "FEDERAL", popularityScore: 62, tags: ["telemedicine", "virtual"] },
  { name: "PlushCare", slug: "plushcare", category: "HEALTHCARE_TELEMEDICINE", description: "Online doctor visits and prescriptions", website: "https://plushcare.com", phone: "1-800-221-5140", scope: "FEDERAL", popularityScore: 60, tags: ["telemedicine", "virtual"] },
  { name: "Hims", slug: "hims", category: "HEALTHCARE_TELEMEDICINE", description: "Men's telehealth for hair, skin, sexual health, mental health", website: "https://www.hims.com", scope: "FEDERAL", popularityScore: 72, tags: ["telemedicine", "mens-health"] },
  { name: "Hers", slug: "hers", category: "HEALTHCARE_TELEMEDICINE", description: "Women's telehealth for skin, hair, mental health, sexual wellness", website: "https://www.forhers.com", scope: "FEDERAL", popularityScore: 70, tags: ["telemedicine", "womens-health"] },
  { name: "Talkspace", slug: "talkspace", category: "HEALTHCARE_TELEMEDICINE", description: "Online therapy and psychiatry", website: "https://www.talkspace.com", scope: "FEDERAL", popularityScore: 75, tags: ["telemedicine", "therapy", "mental-health"] },
  { name: "BetterHelp", slug: "betterhelp", category: "HEALTHCARE_TELEMEDICINE", description: "Online therapy with licensed therapists", website: "https://www.betterhelp.com", scope: "FEDERAL", popularityScore: 82, tags: ["telemedicine", "therapy", "mental-health"] },
  { name: "Ro", slug: "ro", category: "HEALTHCARE_TELEMEDICINE", description: "Telehealth platform for primary, sexual, and weight care", website: "https://ro.co", scope: "FEDERAL", popularityScore: 65, tags: ["telemedicine", "virtual"] },

  // ── Local Dining & Food Discovery (LOCAL_DINING) ──
  { name: "Yelp", slug: "yelp", category: "LOCAL_DINING", description: "Find and review local restaurants and businesses", website: "https://www.yelp.com", scope: "FEDERAL", popularityScore: 88, tags: ["dining", "reviews", "local"] },
  { name: "OpenTable", slug: "opentable", category: "LOCAL_DINING", description: "Restaurant reservations online", website: "https://www.opentable.com", scope: "FEDERAL", popularityScore: 85, tags: ["dining", "reservations"] },
  { name: "Resy", slug: "resy", category: "LOCAL_DINING", description: "Restaurant discovery and reservations by Amex", website: "https://resy.com", scope: "FEDERAL", popularityScore: 75, tags: ["dining", "reservations"] },
  { name: "Uber Eats", slug: "uber-eats", category: "LOCAL_DINING", description: "Food delivery from local restaurants", website: "https://www.ubereats.com", scope: "FEDERAL", popularityScore: 92, tags: ["dining", "delivery"] },
  { name: "Seamless", slug: "seamless", category: "LOCAL_DINING", description: "Food delivery from local restaurants (Grubhub-owned)", website: "https://www.seamless.com", scope: "FEDERAL", popularityScore: 70, tags: ["dining", "delivery"] },
  { name: "Postmates", slug: "postmates", category: "LOCAL_DINING", description: "On-demand food and grocery delivery (Uber-owned)", website: "https://postmates.com", scope: "FEDERAL", popularityScore: 70, tags: ["dining", "delivery"] },
  { name: "Caviar", slug: "caviar", category: "LOCAL_DINING", description: "Upscale food delivery (part of DoorDash)", website: "https://www.trycaviar.com", scope: "FEDERAL", popularityScore: 60, tags: ["dining", "delivery"] },
  { name: "ChowNow", slug: "chownow", category: "LOCAL_DINING", description: "Direct ordering platform for independent restaurants", website: "https://www.chownow.com", scope: "FEDERAL", popularityScore: 55, tags: ["dining", "delivery", "local"] },
  { name: "Toast TakeOut", slug: "toast-takeout", category: "LOCAL_DINING", description: "Order from local restaurants commission-free", website: "https://pos.toasttab.com/products/toast-takeout-app", scope: "FEDERAL", popularityScore: 58, tags: ["dining", "pickup", "local"] },
  { name: "Tock", slug: "tock", category: "LOCAL_DINING", description: "Reservations, ticketed events, and takeout for restaurants", website: "https://www.exploretock.com", scope: "FEDERAL", popularityScore: 58, tags: ["dining", "reservations"] },
  { name: "TripAdvisor", slug: "tripadvisor", category: "LOCAL_DINING", description: "Restaurant and travel reviews worldwide", website: "https://www.tripadvisor.com", scope: "FEDERAL", popularityScore: 78, tags: ["dining", "reviews", "travel"] },

  // ── Childcare / Daycare (KIDS_DAYCARE additions) ──
  { name: "UrbanSitter", slug: "urbansitter", category: "KIDS_DAYCARE", description: "Parent-community based babysitter network", website: "https://www.urbansitter.com", scope: "FEDERAL", popularityScore: 62, tags: ["childcare", "kids", "babysitter"] },
  { name: "La Petite Academy", slug: "la-petite-academy", category: "KIDS_DAYCARE", description: "Preschool and childcare for infants through school-age", website: "https://www.lapetite.com", scope: "FEDERAL", popularityScore: 70, tags: ["childcare", "daycare", "preschool"] },
  { name: "Primrose Schools", slug: "primrose-schools", category: "KIDS_DAYCARE", description: "Premier early education and childcare", website: "https://www.primroseschools.com", scope: "FEDERAL", popularityScore: 72, tags: ["childcare", "daycare", "preschool"] },

  // ── Parking (TRANSPORTATION_PARKING additions) ──
  { name: "SpotHero", slug: "spothero", category: "TRANSPORTATION_PARKING", description: "Reserve parking spots in advance at lots and garages", website: "https://spothero.com", phone: "1-844-356-8054", scope: "FEDERAL", popularityScore: 80, tags: ["parking", "reservation"] },
  { name: "ParkWhiz", slug: "parkwhiz", category: "TRANSPORTATION_PARKING", description: "Book parking in advance at thousands of locations", website: "https://www.parkwhiz.com", scope: "FEDERAL", popularityScore: 72, tags: ["parking", "reservation"] },
  { name: "PayByPhone", slug: "paybyphone", category: "TRANSPORTATION_PARKING", description: "Mobile payments for municipal parking", website: "https://www.paybyphone.com", scope: "FEDERAL", popularityScore: 68, tags: ["parking", "meter"] },
  { name: "Premier Parking", slug: "premier-parking", category: "TRANSPORTATION_PARKING", description: "Parking operator across 30+ US cities", website: "https://www.premierparking.com", scope: "FEDERAL", popularityScore: 58, tags: ["parking"] },

  // ── Internet / Fiber additions (UTILITY_INTERNET) ──
  { name: "T-Mobile Home Internet", slug: "tmobile-home-internet", category: "UTILITY_INTERNET", description: "5G home internet nationwide", website: "https://www.t-mobile.com/home-internet", phone: "1-844-275-9310", scope: "FEDERAL", popularityScore: 78, tags: ["internet", "5g", "wireless"] },
  { name: "Verizon 5G Home Internet", slug: "verizon-5g-home", category: "UTILITY_INTERNET", description: "5G Ultra Wideband home internet", website: "https://www.verizon.com/home/5g-home-internet", phone: "1-800-922-0204", scope: "FEDERAL", popularityScore: 76, tags: ["internet", "5g", "wireless"] },
  { name: "Astound Broadband", slug: "astound", category: "UTILITY_INTERNET", description: "Cable/fiber internet via RCN, Wave, Grande, enTouch", website: "https://www.astound.com", scope: "FEDERAL", popularityScore: 62, tags: ["internet", "cable"] },
  { name: "WOW! Internet", slug: "wow-internet", category: "UTILITY_INTERNET", description: "Broadband cable service in select US markets", website: "https://www.wowway.com", phone: "1-866-496-9669", scope: "FEDERAL", popularityScore: 58, tags: ["internet", "cable"] },
];
