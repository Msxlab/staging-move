# State Provider Completeness Catalog

Generated: 2026-05-07T04:05:37.408Z

## Summary

- Catalog entries: 145
- States covered: 51
- Already present in raw seed: 0
- Newly added in merged seed: 138
- Catalog-only backlog entries: 7
- Coverage models: state=14, zip_prefix=125, polygon=3, live_address=3
- Official URL validation: ok=145, redirect=0, error=0

## Per-State Diff

### AL

- Repo before: Alabama Power, Alagasco, Astound Broadband, AT&T Fiber, Birmingham Water Works, CenturyLink (Lumen), E-ZPass, Frontier Communications, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alabama Freedom Pass, Alabama Power, Alagasco, Astound Broadband, AT&T Fiber, Birmingham Water Works, CenturyLink (Lumen), City of Tuscaloosa Water, Decatur Utilities Electric, E-ZPass, Frontier Communications, Huntsville Utilities, Madison County Water Department, MAX Transit, Mobile Area Water and Sewer System Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- MAX Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://maxtransit.org
  note: Birmingham-area transit provider missing from the seed; modeled with Birmingham metro ZIP prefixes.
- Alabama Department of Revenue Motor Vehicle Division | GOVERNMENT_DMV | newly_added | state | https://www.revenue.alabama.gov/division/motor-vehicle/
  note: Official Alabama motor vehicle registration and tax surface; complements the existing driver-license DMV row.
- Alabama Freedom Pass | TRANSPORTATION_TOLL | newly_added | state | https://freedompass.americanroads.com
  note: Real toll pass account provider; state-scoped because the batch did not include reliable facility ZIPs.
- Decatur Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.decaturutilities.com
  note: Real municipal electric utility; modeled with Decatur-area ZIP prefix and address confirmation language.
- Huntsville Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hsvutil.org
  note: Real municipal utility; gas duplicate is folded into this single provider row.
- Southeast Gas | UTILITY_GAS | catalog_backlog | live_address | https://southeastgas.com
  note: Real gas utility from Batch 1, but the candidate had unknown territory; catalog-only until ZIP/service-area confirmation.
- City of Huntsville Water Pollution Control | UTILITY_SEWER | newly_added | zip_prefix | https://www.huntsvilleal.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Jefferson County Environmental Services Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.jeffcoes.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of Tuscaloosa Water | UTILITY_WATER | newly_added | zip_prefix | https://www.tuscaloosa.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Madison County Water Department | UTILITY_WATER | newly_added | zip_prefix | https://www.madisoncountyal.gov/departments/water-department
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Mobile Area Water and Sewer System Water | UTILITY_WATER | newly_added | zip_prefix | https://www.mawss.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### AK

- Repo before: Anchorage Water & Wastewater Utility, Astound Broadband, AT&T Fiber, Chugach Electric, E-ZPass, ENSTAR Natural Gas, GCI, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alaska Electric Light and Power, Anchorage Water & Wastewater Utility, Anton Anderson Memorial Tunnel / Whittier Tunnel, Astound Broadband, AT&T Fiber, Chugach Electric, City and Borough of Juneau Water Utility, College & Golden Heart Utilities Water, E-ZPass, ENSTAR Natural Gas, GCI, Golden Valley Electric Association, Homer Electric Association, Interior Gas Utility, Ketchikan Public Utilities Electric, Matanuska Electric Association, People Mover, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- People Mover | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.muni.org/Departments/transit/PeopleMover/pages/mapsandstops.aspx
  note: Anchorage People Mover is the largest public transit provider in Alaska and was not in seed.
- Alaska Communications | UTILITY_INTERNET | catalog_backlog | live_address | https://www.alaskacommunications.com/Residential
  note: Alaska Communications is a major Alaska ISP/voice provider. The official surface is address-qualified rather than ZIP-complete.
- Anton Anderson Memorial Tunnel / Whittier Tunnel | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://dot.alaska.gov/creg/whittiertunnel/index.shtml
  note: Batch 1 toll facility addition; corridor-scoped and not a statewide Alaska toll recommendation.
- Alaska Electric Light and Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.aelp.com
  note: Real electric utility; modeled with Juneau-area ZIP prefix and address confirmation language.
- Golden Valley Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.gvea.com
  note: Real electric utility; modeled with cautious AK 997 ZIP prefix and address confirmation language.
- Homer Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.homerelectric.com
  note: Real electric utility; modeled with cautious AK 996 ZIP prefix and address confirmation language.
- Ketchikan Public Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.ketchikan.gov/ketchikan-public-utilities
  note: Real municipal electric utility; modeled with Ketchikan-area ZIP prefix and address confirmation language.
- Matanuska Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mea.coop
  note: Real electric cooperative; modeled with cautious AK 995/996 ZIP prefixes and address confirmation language.
- Interior Gas Utility | UTILITY_GAS | newly_added | zip_prefix | https://www.interiorgas.com
  note: Real gas utility; modeled with cautious AK 997 ZIP prefix and address confirmation language.
- City and Borough of Juneau Water Utility | UTILITY_WATER | newly_added | zip_prefix | https://juneau.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- College & Golden Heart Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.mywater.us/alaska/about-us-menu
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### AZ

- Repo before: APS (Arizona Public Service), Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, Frontier Communications, Google Fiber, Mesa Utilities, Phoenix Water Services, Southwest Gas, Spectrum, SRP (Salt River Project), Starlink, T-Mobile Home Internet, Tucson Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: APS (Arizona Public Service), Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Chandler Water, City of Tempe Water Services, Cox Communications, E-ZPass, Frontier Communications, Glendale Water Services, Google Fiber, Mesa Utilities, Phoenix Water Services, Scottsdale Water, Southwest Gas, Spectrum, SRP (Salt River Project), Starlink, T-Mobile Home Internet, Town of Gilbert Water, Tucson Electric Power, Tucson Water, UniSource Energy Services, Valley Metro, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Valley Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.valleymetro.org/maps-schedules
  note: Phoenix-area Valley Metro was absent from seed and is modeled with core metro ZIP prefixes.
- Tucson Electric Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.tep.com
  note: Real electric utility; modeled with Tucson-area ZIP prefixes and address confirmation language.
- UniSource Energy Services Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.uesaz.com
  note: Real utility account provider; gas duplicate is folded into this single provider row.
- Pima County Regional Wastewater Reclamation Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.pima.gov/wastewater
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of Chandler Water | UTILITY_WATER | newly_added | zip_prefix | https://www.chandleraz.gov/residents/water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of Tempe Water Services | UTILITY_WATER | newly_added | zip_prefix | https://www.tempe.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Glendale Water Services | UTILITY_WATER | newly_added | zip_prefix | https://www.glendaleaz.com/live/city_services/water_services
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Scottsdale Water | UTILITY_WATER | newly_added | zip_prefix | https://www.scottsdaleaz.gov/water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Town of Gilbert Water | UTILITY_WATER | newly_added | zip_prefix | https://www.gilbertaz.gov/departments/public-works/water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### AR

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, CenterPoint Energy Arkansas, Central Arkansas Water, CenturyLink (Lumen), Cox Communications, E-ZPass, OG&E, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Arkansas Oklahoma Gas, Astound Broadband, AT&T Fiber, Bentonville Water Utilities, Black Hills Energy SD, CenterPoint Energy Arkansas, Central Arkansas Water, CenturyLink (Lumen), Conway Corp Electric, Cox Communications, E-ZPass, Entergy Arkansas, Fayetteville Water and Sewer, Fort Smith Utilities Water, Jonesboro City Water and Light Water, North Little Rock Electric, OG&E, Rogers Water Utilities, Southwestern Electric Power Company (SWEPCO), Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Entergy Arkansas | UTILITY_ELECTRIC | newly_added | state | https://www.entergy-arkansas.com
  note: Major Arkansas electric utility identified in state rules but missing from seed.
- Conway Corp Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.conwaycorp.com
  note: Real municipal electric utility; modeled with Conway-area ZIP prefix and address confirmation language.
- North Little Rock Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://nlrelectric.com
  note: Real municipal electric utility; modeled with North Little Rock ZIP prefix and address confirmation language.
- Southwestern Electric Power Company (SWEPCO) | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.swepco.com
  note: Real electric utility; modeled with cautious Arkansas ZIP prefixes and address confirmation language.
- Arkansas Oklahoma Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.aogc.com
  note: Real gas utility; modeled with cautious western Arkansas ZIP prefix and address confirmation language.
- Summit Utilities Arkansas | UTILITY_GAS | catalog_backlog | live_address | https://summitutilities.com
  note: Real gas utility from Batch 1, but the candidate had unknown territory; catalog-only until ZIP/service-area confirmation.
- Little Rock Water Reclamation Authority | UTILITY_SEWER | newly_added | zip_prefix | https://lrwra.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Springdale Water Utilities Wastewater | UTILITY_SEWER | newly_added | zip_prefix | https://springdalewater.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Bentonville Water Utilities | UTILITY_WATER | newly_added | zip_prefix | https://www.bentonvillear.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Fayetteville Water and Sewer | UTILITY_WATER | newly_added | zip_prefix | https://www.fayetteville-ar.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Fort Smith Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fortsmithar.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Jonesboro City Water and Light Water | UTILITY_WATER | newly_added | zip_prefix | https://www.jonesborocwl.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Rogers Water Utilities | UTILITY_WATER | newly_added | zip_prefix | https://www.rwu.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### CA

- Repo before: AC Transit, Astound Broadband, AT&T Fiber, BART, Caltrain, Cox Communications, E-ZPass, FasTrak, Frontier Communications, LA Metro, LADWP, PG&E, San Diego MTS, SF Muni, SoCal Edison, SoCal Gas, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
- Repo after: 91 Express Lanes, AC Transit, Astound Broadband, AT&T Fiber, BART, Caltrain, City of Fresno Utilities Water, City of Sacramento Department of Utilities Water, City of San Diego Public Utilities Water, Cox Communications, E-ZPass, East Bay Municipal Utility District Water, FasTrak, Frontier Communications, LA Metro, LADWP, Long Beach Utilities Water, Metro ExpressLanes, PG&E, Sacramento Municipal Utility District, San Diego Gas & Electric, San Diego MTS, San Jose Water, SF Muni, SoCal Edison, SoCal Gas, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, The Toll Roads, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
- San Diego Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.sdge.com/landservices
  note: SDG&E serves San Diego County and parts of southern Orange County; modeled conservatively with southern California ZIP prefixes.
- 91 Express Lanes | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.91expresslanes.com
  note: Real toll account provider; modeled only around the corridor ZIP prefixes from Batch 1.
- Metro ExpressLanes | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.metroexpresslanes.net
  note: Real toll account provider; modeled only around Los Angeles corridor ZIP prefixes from Batch 1.
- The Toll Roads | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.thetollroads.com
  note: Real toll account provider; modeled only around Orange County corridor ZIP prefixes from Batch 1.
- Sacramento Municipal Utility District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.smud.org
  note: Real electric utility; modeled with cautious Sacramento-area ZIP prefixes and address confirmation language.
- City of Fresno Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fresno.gov/publicutilities/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of Sacramento Department of Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.cityofsacramento.gov/utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of San Diego Public Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.sandiego.gov/public-utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- East Bay Municipal Utility District Water | UTILITY_WATER | newly_added | zip_prefix | https://www.ebmud.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Long Beach Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.longbeach.gov/utilityservices/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- San Jose Water | UTILITY_WATER | newly_added | zip_prefix | https://www.sjwater.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### CO

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Colorado, Black Hills Energy SD, CenturyLink (Lumen), Denver Water, E-ZPass, ExpressToll, Google Fiber, RTD, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Aurora Water, Black Hills Energy Colorado, Black Hills Energy SD, CenturyLink (Lumen), City of Boulder Water Utilities, Colorado Springs Utilities Water, Denver Water, E-470 Public Highway Authority, E-ZPass, ExpressToll, Fort Collins Utilities Water, Google Fiber, Northwest Parkway, RTD, RTD Denver, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- RTD Denver | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.rtd-denver.com/system-map
  note: Regional Transportation District is the core transit provider for Denver metro.
- E-470 Public Highway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.e-470.com
  note: Real toll account provider; modeled only around Denver-area corridor ZIP prefixes from Batch 1.
- Northwest Parkway | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.nwpky.com
  note: Real toll road account surface; modeled only around corridor ZIP prefixes from Batch 1.
- Aurora Water | UTILITY_WATER | newly_added | zip_prefix | https://www.auroragov.org/residents/water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- City of Boulder Water Utilities | UTILITY_WATER | newly_added | zip_prefix | https://bouldercolorado.gov/services/water-utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Colorado Springs Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.csu.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Fort Collins Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fcgov.com/utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### CT

- Repo before: Aquarion Water, Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Eversource, Eversource NH, Frontier Communications, Optimum, Southern Connecticut Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water, Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Eversource, Eversource NH, Frontier Communications, Jewett City Department of Public Utilities, Metropolitan District Commission, Norwich Public Utilities, Optimum, South Central Connecticut Regional Water Authority, Southern Connecticut Gas, Spectrum, Starlink, T-Mobile Home Internet, United Illuminating, Verizon 5G Home Internet, Verizon Fios, Wallingford Electric Division, WOW! Internet, Xfinity (Comcast)
- United Illuminating | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.uinet.com/ourcompany/whoweare/servicearea
  note: United Illuminating covers southern Connecticut and is a material seed gap for CT.
- Connecticut Natural Gas | UTILITY_GAS | catalog_backlog | zip_prefix | https://www.cngcorp.com
  note: Connecticut Natural Gas is a real utility account provider, but remains catalog-only until cleaner service-area ZIPs are confirmed.
- Access Health CT | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.accesshealthct.com
  note: Official Connecticut health marketplace account surface, modeled with Connecticut ZIP prefixes.
- HUSKY Health | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://portal.ct.gov/HUSKY
  note: Official Connecticut Medicaid/HUSKY health account surface, modeled with Connecticut ZIP prefixes.
- Connecticut Department of Revenue Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://portal.ct.gov/DRS
  note: Official Connecticut tax account/address surface, modeled with Connecticut ZIP prefixes.
- Jewett City Department of Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.jewettcitydpu.com
  note: Real municipal electric utility; modeled with CT 063 ZIP prefix and address confirmation language.
- Norwich Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://norwichpublicutilities.com
  note: Real municipal utility; modeled with CT 063 ZIP prefix and address confirmation language.
- Wallingford Electric Division | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.wallingfordct.gov/government/departments/electric-division/
  note: Real municipal electric utility; modeled with CT 064 ZIP prefix and address confirmation language.
- Bridgeport Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.bridgeportct.gov/government/departments/water-pollution-control-authority-wpca
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Greater New Haven Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://gnhwpca.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Stamford Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.stamfordct.gov/government/operations/water-pollution-control-authority
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Metropolitan District Commission | UTILITY_WATER | newly_added | zip_prefix | https://themdc.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- South Central Connecticut Regional Water Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.rwater.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### DE

- Repo before: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities Delaware, Delmarva Power, E-ZPass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities Delaware, City of Dover Electric Department, City of Milford Electric, City of Newark Electric, DART First State, Delaware E-ZPass, Delaware Electric Cooperative, Delmarva Power, E-ZPass, Lewes Board of Public Works Electric, Municipal Services Commission of the City of New Castle Electric, Spectrum, Starlink, T-Mobile Home Internet, Town of Middletown Electric, Town of Smyrna Electric, Verizon 5G Home Internet, Verizon Fios, Wilmington Water Utility, WOW! Internet, Xfinity (Comcast)
- DART First State | TRANSPORTATION_TRANSIT | newly_added | state | https://dartfirststate.com/map/
  note: DART First State operates statewide bus and paratransit service in Delaware.
- Delaware Medicaid / ASSIST | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://assist.dhss.delaware.gov
  note: Official Delaware benefits and Medicaid account surface, modeled with Delaware ZIP prefixes.
- Delaware Taxpayer Portal | GOVERNMENT_TAX | newly_added | zip_prefix | https://tax.delaware.gov
  note: Official Delaware taxpayer account surface, modeled with Delaware ZIP prefixes.
- Delaware E-ZPass | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ezpassde.com
  note: Real Delaware toll account provider; US 301 toll-by-plate row is folded into this account surface.
- City of Dover Electric Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cityofdover.gov/Public-Utilities/
  note: Real municipal electric utility; modeled with exact Dover ZIPs from Batch 1 and address confirmation language.
- City of Milford Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cityofmilford.com
  note: Real municipal electric utility; modeled with exact Milford ZIP from Batch 1 and address confirmation language.
- City of Newark Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://newarkde.gov/18/Electrical-Engineering
  note: Real municipal electric utility; modeled with exact Newark ZIPs from Batch 1 and address confirmation language.
- Delaware Electric Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.delaware.coop
  note: Real electric cooperative; modeled with cautious DE 199 ZIP prefix and address confirmation language.
- Lewes Board of Public Works Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.lewesbpwde.gov
  note: Real municipal electric utility; modeled with exact Lewes ZIP from Batch 1 and address confirmation language.
- Municipal Services Commission of the City of New Castle Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://newcastlemsc.delaware.gov
  note: Real municipal electric utility; modeled with exact New Castle ZIP from Batch 1 and address confirmation language.
- Town of Middletown Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.middletown.delaware.gov
  note: Real municipal electric utility; modeled with exact Middletown ZIPs from Batch 1 and address confirmation language.
- Town of Smyrna Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://smyrna.delaware.gov
  note: Real municipal electric utility; modeled with exact Smyrna ZIP from Batch 1 and address confirmation language.
- Kent County Wastewater Division | UTILITY_SEWER | newly_added | zip_prefix | https://www.kentcountyde.gov/My-Government/Departments/Public-Works
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- New Castle County Sewer | UTILITY_SEWER | newly_added | zip_prefix | https://www.newcastlede.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Sussex County Environmental Services | UTILITY_SEWER | newly_added | zip_prefix | https://sussexcountyde.gov/sewer-water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Wilmington Water Utility | UTILITY_WATER | newly_added | zip_prefix | https://www.wilmingtondewater.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### DC

- Repo before: Astound Broadband, AT&T Fiber, DC Water, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, DC Streetcar, DC Water, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- DC Streetcar | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://dcstreetcar.com
  note: DC Streetcar adds a district-specific transit option beyond WMATA.
- DC Health Link | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.dchealthlink.com
  note: Official DC health marketplace account surface, modeled with District ZIP prefixes.
- District Direct | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://districtdirect.dc.gov
  note: Official DC benefits account portal, modeled with District ZIP prefixes.
- MyTax.DC.gov | GOVERNMENT_TAX | newly_added | zip_prefix | https://mytax.dc.gov
  note: Official DC tax account portal, modeled with District ZIP prefixes.

### FL

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Duke Energy Florida, E-ZPass, FPL (Florida Power & Light), Frontier Communications, JEA, Lynx, Miami-Dade Transit, Miami-Dade Water & Sewer, Orlando Utilities Commission, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Tampa Water Department, TECO Peoples Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Duke Energy Florida, E-PASS / Central Florida Expressway Authority, E-ZPass, Florida City Gas, FPL (Florida Power & Light), Frontier Communications, Greater Miami Expressway Agency, Hillsborough County Water Resources, I-4 Express, JEA, Lynx, Miami-Dade Transit, Miami-Dade Water & Sewer, Orlando Utilities Commission, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Tampa Electric, Tampa Hillsborough Expressway Authority, Tampa Water Department, TECO Peoples Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Tampa Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.tampaelectric.com/economicdevelopment/serviceareaandreliability/
  note: Tampa Electric is a major missing Florida electric provider with a clear Tampa Bay service area.
- Florida KidCare | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.floridakidcare.org
  note: Official Florida child health insurance account surface, modeled with Florida ZIP prefixes from Batch 1.
- Florida Medicaid / MyACCESS | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://myaccess.myflfamilies.com
  note: Official Florida benefits/Medicaid account surface, modeled with Florida ZIP prefixes from Batch 1.
- Florida DOR e-Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://floridarevenue.com
  note: Official Florida tax e-services account surface, modeled with Florida ZIP prefixes from Batch 1.
- E-PASS / Central Florida Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.cfxway.com
  note: Real Central Florida toll account provider; modeled around Batch 1 corridor ZIP prefixes.
- Greater Miami Expressway Agency | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.gmx-way.com
  note: Real Miami-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- I-4 Express | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://i4express.com
  note: Real I-4 Express toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- Tampa Hillsborough Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.tampa-xway.com
  note: Real Tampa-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- Florida City Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.floridacitygas.com
  note: Real gas utility; modeled with cautious South Florida ZIP prefixes and address confirmation language.
- Hillsborough County Water Resources | UTILITY_WATER | newly_added | zip_prefix | https://hcfl.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.

### GA

- Repo before: Astound Broadband, AT&T Fiber, Atlanta Watershed Management, CenturyLink (Lumen), Cox Communications, E-ZPass, Georgia Natural Gas, Georgia Power, Google Fiber, MARTA, Peach Pass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atlanta Gas Light, Atlanta Watershed Management, CenturyLink (Lumen), Cox Communications, E-ZPass, Georgia Natural Gas, Georgia Power, Google Fiber, MARTA, Peach Pass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Atlanta Gas Light | UTILITY_GAS | newly_added | state | https://www.atlantagaslight.com
  note: Atlanta Gas Light remains a key Georgia gas infrastructure provider missing from seed.

### HI

- Repo before: Astound Broadband, AT&T Fiber, Board of Water Supply (Honolulu), E-ZPass, Hawaii Gas, Hawaiian Electric (HECO), Hawaiian Telcom, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Board of Water Supply (Honolulu), E-ZPass, Hawaii Gas, Hawaiian Electric (HECO), Hawaiian Telcom, Skyline, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Skyline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.honolulu.gov/skyline
  note: Honolulu Skyline adds a rail-specific transit surface beyond TheBus.

### ID

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy Utah, E-ZPass, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy Utah, E-ZPass, Idaho Power, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Idaho Power | UTILITY_ELECTRIC | newly_added | state | https://www.idahopower.com
  note: Idaho Power is the dominant investor-owned electric utility in southern Idaho and a major catalog gap.

### IL

- Repo before: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Chicago Water Department, ComEd, CTA, E-ZPass, Frontier Communications, I-PASS, Illinois American Water, Metra, Nicor Gas, Pace Bus, Peoples Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Ameren Illinois, Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Chicago Water Department, ComEd, CTA, E-ZPass, Frontier Communications, I-PASS, Illinois American Water, Metra, Nicor Gas, Pace Bus, Peoples Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Ameren Illinois | UTILITY_ELECTRIC | newly_added | state | https://www.ameren.com/illinois/about
  note: Ameren Illinois is the major downstate Illinois electric utility and was not represented directly in seed.

### IN

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Citizens Energy Group, Duke Energy Indiana, E-ZPass, Frontier Communications, Indiana American Water, IndyGo, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Citizens Energy Group, Duke Energy Indiana, E-ZPass, Frontier Communications, Indiana American Water, Indiana Michigan Power, IndyGo, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Indiana Michigan Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.indianamichiganpower.com
  note: Indiana Michigan Power is a large AEP utility missing from Indiana coverage.

### IA

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Iowa, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Iowa American Water, Mediacom, MidAmerican Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alliant Energy, Astound Broadband, AT&T Fiber, Black Hills Energy Iowa, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Iowa American Water, Mediacom, MidAmerican Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Alliant Energy | UTILITY_ELECTRIC | newly_added | state | https://www.alliantenergy.com/who-we-are/communities-we-serve
  note: Alliant Energy is a major Iowa/Wisconsin utility called out in state rules but missing from seed.

### KS

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Evergy, Google Fiber, K-TAG, Kansas Gas Service, Midco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WaterOne, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Evergy, Google Fiber, K-TAG, Kansas Gas Service, Midco, RideKC, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WaterOne, WOW! Internet, Xfinity (Comcast)
- RideKC | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridekc.org/rider-guide/system-map
  note: Kansas City regional transit system missing from both Kansas and Missouri seed surfaces.

### KY

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Kentucky, E-ZPass, Kentucky Utilities, Louisville Water Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Kentucky, E-ZPass, Kentucky Utilities, Louisville Gas & Electric, Louisville Water Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Louisville Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://lge-ku.com
  note: LG&E is the core Louisville-area utility and was missing from Kentucky coverage.

### LA

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Louisiana, CenturyLink (Lumen), Cox Communications, E-ZPass, Entergy Louisiana, GeauxPass, New Orleans Regional Transit Authority, Sewerage & Water Board of New Orleans, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Louisiana, Capital Area Transit System, CenturyLink (Lumen), Cox Communications, E-ZPass, Entergy Louisiana, GeauxPass, New Orleans Regional Transit Authority, Sewerage & Water Board of New Orleans, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Capital Area Transit System | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.brcats.com
  note: Baton Rouge CATS expands Louisiana transit beyond the New Orleans region already in seed.

### ME

- Repo before: Astound Broadband, AT&T Fiber, Central Maine Power, Consolidated Communications VT, E-ZPass, Maine Water Company, Spectrum, Spectrum Maine, Starlink, Summit Natural Gas of Maine, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Versant Power, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Central Maine Power, Consolidated Communications VT, E-ZPass, Greater Portland METRO, Maine Water Company, Spectrum, Spectrum Maine, Starlink, Summit Natural Gas of Maine, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Versant Power, WOW! Internet, Xfinity (Comcast)
- Greater Portland METRO | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://gpmetro.org
  note: Greater Portland METRO adds a missing Maine transit provider with a compact service footprint.

### MD

- Repo before: Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities Delaware, Delmarva Power, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities Delaware, Delmarva Power, E-ZPass, MTA Maryland, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- MTA Maryland | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.mta.maryland.gov/transit-maps
  note: Maryland Transit Administration adds a missing Baltimore-centric transit surface.

### MA

- Repo before: Aquarion Water, Astound Broadband, AT&T Fiber, Boston Water and Sewer Commission, E-ZPass, Eversource, Eversource NH, MBTA, National Grid MA, Spectrum, Starlink, T-Mobile Home Internet, Unitil New Hampshire, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water, Astound Broadband, AT&T Fiber, Boston Water and Sewer Commission, E-ZPass, Eversource, Eversource NH, Massachusetts Water Resources Authority, MBTA, National Grid MA, Spectrum, Starlink, T-Mobile Home Internet, Unitil New Hampshire, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Massachusetts Water Resources Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.mwra.com
  note: MWRA covers Boston-region wholesale water/sewer service and adds a missing Massachusetts water surface.

### MI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, SMART, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- SMART | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.smartbus.org/Routes-Schedules/System-Map
  note: Suburban Mobility Authority for Regional Transportation adds the Detroit suburban network missing from seed.

### MN

- Repo before: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Minnesota Energy Resources, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- Minnesota Energy Resources | UTILITY_GAS | newly_added | state | https://www.minnesotaenergyresources.com
  note: Minnesota Energy Resources adds a missing statewide gas utility surface beyond CenterPoint.

### MS

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Mississippi, CenturyLink (Lumen), E-ZPass, Entergy Mississippi, Jackson Water, Mississippi Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Mississippi, CenturyLink (Lumen), Coast Transit Authority, E-ZPass, Entergy Mississippi, Jackson Water, Mississippi Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Coast Transit Authority | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://coasttransit.com
  note: Mississippi Gulf Coast transit provider missing from seed.

### MO

- Repo before: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Evergy, Google Fiber, Metro Transit St. Louis, Missouri American Water, Spectrum, Spire Missouri, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Evergy, Google Fiber, Metro Transit St. Louis, Missouri American Water, RideKC, Spectrum, Spire Missouri, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RideKC | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridekc.org/rider-guide/system-map
  note: Kansas City regional transit system missing from both Kansas and Missouri seed surfaces.

### MT

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Billings Water, E-ZPass, MDU Resources, NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Billings Water, E-ZPass, MDU Resources, Mountain Line, NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Mountain Line | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://mountainline.com/system-map/
  note: Missoula-area transit addition for Montana.

### NE

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Nebraska, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Metropolitan Utilities District (Omaha), NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy Nebraska, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Metropolitan Utilities District (Omaha), NorthWestern Energy, Omaha Public Power District, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Omaha Public Power District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oppd.com/about/service-area/
  note: OPPD is a major Nebraska public-power provider missing from seed.

### NV

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Las Vegas Valley Water, NV Energy, RTC Southern Nevada, Southwest Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Las Vegas Valley Water, NV Energy, RTC Southern Nevada, RTC Washoe, Southwest Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RTC Washoe | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://rtcwashoe.com/public-transportation/system-map/
  note: RTC Washoe adds northern Nevada transit coverage beyond Las Vegas-area service already in seed.

### NH

- Repo before: Aquarion Water, Astound Broadband, AT&T Fiber, Consolidated Communications VT, E-ZPass, Eversource, Eversource NH, Liberty Utilities NH, Pennichuck Water, Spectrum, Starlink, T-Mobile Home Internet, Unitil New Hampshire, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water, Astound Broadband, AT&T Fiber, COAST, Consolidated Communications VT, E-ZPass, Eversource, Eversource NH, Liberty Utilities NH, Pennichuck Water, Spectrum, Starlink, T-Mobile Home Internet, Unitil New Hampshire, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- COAST | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://coastbus.org/schedules
  note: COAST adds a New Hampshire transit provider for the Seacoast region.

### NJ

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, PATCO Speedline, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.

### NM

- Repo before: Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: ABQ RIDE, Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- ABQ RIDE | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cabq.gov/transit/routes-and-schedules/system-map
  note: Albuquerque transit addition for New Mexico.

### NY

- Repo before: Astound Broadband, AT&T Fiber, Con Edison, E-ZPass, Frontier Communications, MTA, National Grid NY, NY E-ZPass, NYC Water Board, Optimum, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Con Edison, E-ZPass, Frontier Communications, MTA, National Grid NY, NY E-ZPass, NYC Water Board, Optimum, PSEG Long Island, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PSEG Long Island | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.psegliny.com
  note: Long Island electric utility surface missing from the seed's New York coverage.

### NC

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Charlotte Water, Dominion Energy, Duke Energy NC, Durham Water, E-ZPass, Google Fiber, GoRaleigh, GoTriangle, Piedmont Natural Gas Tennessee, PSNC Energy, Raleigh Water, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Charlotte Water, Dominion Energy, Duke Energy NC, Durham Water, E-ZPass, Google Fiber, GoRaleigh, GoTriangle, Piedmont Natural Gas, Piedmont Natural Gas Tennessee, PSNC Energy, Raleigh Water, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Piedmont Natural Gas | UTILITY_GAS | newly_added | state | https://www.piedmontng.com
  note: Piedmont Natural Gas is a major Carolinas utility missing from the seed surface.

### ND

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Montana-Dakota Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.

### OH

- Repo before: AEP Ohio, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cincinnati Water Works, Cleveland Water, Columbia Gas of Ohio, Columbus Utilities, COTA, Cox Communications, E-ZPass, Frontier Communications, Ohio Edison, RTA Cleveland, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: AEP Ohio, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cincinnati Water Works, Cleveland Water, Columbia Gas of Ohio, Columbus Utilities, COTA, Cox Communications, E-ZPass, Frontier Communications, Ohio Edison, RTA Cleveland, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Ohio Turnpike E-ZPass | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.ezpassoh.com
  note: Ohio toll coverage is corridor-driven rather than ZIP-clean, so this remains catalog-only until polygon modeling lands.

### OK

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, EMBARK, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- EMBARK | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://embarkok.com/system-map/
  note: Oklahoma City EMBARK adds a missing Oklahoma transit provider.

### OR

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, NW Natural Gas, Portland General Electric, Portland Water Bureau, Spectrum, Starlink, T-Mobile Home Internet, TriMet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, NW Natural Gas, Pacific Power, Portland General Electric, Portland Water Bureau, Spectrum, Starlink, T-Mobile Home Internet, TriMet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Pacific Power | UTILITY_ELECTRIC | newly_added | state | https://www.pacificpower.net/about.html
  note: Pacific Power is a major Oregon utility missing from seed.

### PA

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, PA Turnpike E-ZPass, PECO Energy, Philadelphia Water Department, Pittsburgh Port Authority, Pittsburgh Water & Sewer, PPL Electric, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Columbia Gas of Pennsylvania, E-ZPass, Frontier Communications, PA Turnpike E-ZPass, PATCO Speedline, PECO Energy, Philadelphia Water Department, Pittsburgh Port Authority, Pittsburgh Water & Sewer, PPL Electric, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.
- Columbia Gas of Pennsylvania | UTILITY_GAS | newly_added | state | https://www.columbiagaspa.com
  note: Major Pennsylvania gas utility called out in state rules but missing from seed.

### RI

- Repo before: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, RIPTA, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RIPTA | TRANSPORTATION_TRANSIT | newly_added | state | https://ripta.com/statewide-system-map/
  note: RIPTA provides statewide Rhode Island transit service and should exist explicitly in seed.

### SC

- Repo before: Astound Broadband, AT&T Fiber, Charleston Water System, Dominion Energy, Dominion Energy South Carolina Gas, Duke Energy NC, E-ZPass, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CARTA, Charleston Water System, Dominion Energy, Dominion Energy South Carolina Gas, Duke Energy NC, E-ZPass, Piedmont Natural Gas, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Piedmont Natural Gas | UTILITY_GAS | newly_added | state | https://www.piedmontng.com
  note: Piedmont Natural Gas is a major Carolinas utility missing from the seed surface.
- CARTA | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridecarta.com
  note: Charleston Area Regional Transportation Authority adds a South Carolina transit option beyond utility-only coverage.

### SD

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, E-ZPass, MDU Resources, MDU Resources South Dakota Gas, Midco, NorthWestern Energy, Sioux Falls Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, E-ZPass, MDU Resources, MDU Resources South Dakota Gas, Midco, Montana-Dakota Utilities, NorthWestern Energy, Sioux Area Metro, Sioux Falls Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
- Sioux Area Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.siouxfalls.gov/sam
  note: Sioux Falls transit surface for South Dakota.

### TN

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Google Fiber, Nashville Electric Service, Nashville Water Services, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WeGo Public Transit, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Google Fiber, Memphis Light, Gas and Water, Nashville Electric Service, Nashville Water Services, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WeGo Public Transit, WOW! Internet, Xfinity (Comcast)
- Memphis Light, Gas and Water | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mlgw.com
  note: MLGW is a major missing Memphis-area multi-utility provider.

### TX

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy, Austin Water, CapMetro, CenterPoint Energy, CenturyLink (Lumen), Dallas Water Utilities, DART, E-ZPass, Frontier Communications, Google Fiber, Houston METRO, Houston Public Works, Reliant Energy, San Antonio Water System, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Trinity Metro, TxTag, TXU Energy, Verizon 5G Home Internet, Verizon Fios, VIA Metropolitan Transit, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy, Austin Water, CapMetro, CenterPoint Energy, CenturyLink (Lumen), Dallas Water Utilities, DART, E-ZPass, Frontier Communications, Google Fiber, Houston METRO, Houston Public Works, North Texas Tollway Authority, Reliant Energy, San Antonio Water System, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Trinity Metro, TxTag, TXU Energy, Verizon 5G Home Internet, Verizon Fios, VIA Metropolitan Transit, WOW! Internet, Xfinity (Comcast)
- North Texas Tollway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ntta.org
  note: NTTA adds a Dallas-Fort Worth toll corridor provider beyond statewide Texas toll tags.
- Oncor Electric Delivery | UTILITY_ELECTRIC | catalog_backlog | polygon | https://www.oncor.com
  note: Oncor is a critical Texas delivery utility, but its territory should be polygon-modeled rather than blindly state-scoped.

### UT

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Dominion Energy Utah, E-ZPass, Google Fiber, Rocky Mountain Power, Salt Lake City Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Dominion Energy Utah, E-ZPass, Google Fiber, Rocky Mountain Power, Salt Lake City Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Express Pass | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.expresspass.utah.gov
  note: Utah Express Pass is corridor-based toll coverage and remains catalog-only until toll polygons land.

### VT

- Repo before: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Green Mountain Transit, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Green Mountain Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridegmt.com
  note: Green Mountain Transit adds a Vermont transit provider beyond utility-only coverage.

### VA

- Repo before: Appalachian Power WV, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy, E-ZPass, Fairfax Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power WV, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy, E-ZPass, Fairfax Water, Hampton Roads Transit, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Hampton Roads Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://gohrt.com/routes/
  note: HRT expands Virginia transit coverage beyond DC-region rail providers.

### WA

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, Good To Go!, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, Good To Go!, King County Metro, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- King County Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://kingcounty.gov/en/dept/metro
  note: King County Metro adds the largest Washington transit network beyond Seattle-only utilities.

### WV

- Repo before: Appalachian Power WV, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountaineer Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power WV, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountain Line Transit Authority, Mountaineer Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Mountain Line Transit Authority | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://busride.org/routes/
  note: West Virginia transit addition centered on Morgantown.

### WI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Alliant Energy, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy, Xcel Energy ND, Xfinity (Comcast)
- Alliant Energy | UTILITY_ELECTRIC | newly_added | state | https://www.alliantenergy.com/who-we-are/communities-we-serve
  note: Alliant Energy is a major Iowa/Wisconsin utility called out in state rules but missing from seed.

### WY

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, Dominion Energy Utah, E-ZPass, MDU Resources, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, Cheyenne Transit Program, Dominion Energy Utah, E-ZPass, MDU Resources, Montana-Dakota Utilities, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
- Cheyenne Transit Program | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cheyennecity.org/Your-Government/Departments/Public-Works/Transit/Fixed-Route-Service
  note: Cheyenne Transit Program adds a Wyoming public transit surface beyond utilities.

