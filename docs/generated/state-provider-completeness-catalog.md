# State Provider Completeness Catalog

Generated: 2026-05-13T17:26:44.960Z

## Summary

- Catalog entries: 292
- States covered: 49
- Already present in raw seed: 1
- Newly added in merged seed: 284
- Catalog-only backlog entries: 7
- Coverage models: state=17, zip_prefix=202, polygon=4, live_address=69
- Official URL validation: ok=292, redirect=0, error=0

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

- Repo before: AC Transit, Astound Broadband, AT&T Fiber, BART, Bay Area FasTrak, Caltrain, Cox Communications, E-ZPass, Frontier Communications, LA Metro, LADWP, PG&E, San Diego MTS, SF Muni, SoCalGas, Southern California Edison, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
- Repo after: 91 Express Lanes, AC Transit, Astound Broadband, AT&T Fiber, BART, Bay Area FasTrak, Caltrain, City of Fresno Utilities Water, City of Sacramento Department of Utilities Water, City of San Diego Water/Wastewater, Cox Communications, E-ZPass, East Bay Municipal Utility District Water, Frontier Communications, Golden State Water, LA Metro, LADWP, Long Beach Utilities Water, Metro ExpressLanes, PG&E, Riverside Express, Sacramento Municipal Utility District, San Diego Gas & Electric, San Diego MTS, San Jose Water, SANDAG FasTrak, SF Muni, SoCalGas, Southern California Edison, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, The Toll Roads, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
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
- City of San Diego Water/Wastewater | UTILITY_WATER | newly_added | zip_prefix | https://www.sandiego.gov/public-utilities/customer-support
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- East Bay Municipal Utility District Water | UTILITY_WATER | newly_added | zip_prefix | https://www.ebmud.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Long Beach Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.longbeach.gov/utilityservices/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- San Jose Water | UTILITY_WATER | newly_added | zip_prefix | https://www.sjwater.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Recology San Francisco | UTILITY_TRASH | newly_added | zip_prefix | https://www.recology.com/recology-san-francisco/
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Golden State Water | UTILITY_WATER | newly_added | zip_prefix | https://www.gswater.com/your-service-area
  note: Golden State Water serves many non-contiguous California communities across multiple regions; ZIP prefixes are intentionally broad prefilters and service address confirmation is required.
- Riverside Express | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.riversideexpress.com
  note: Secondary Southern California toll account surface for Riverside County 15 Express Lanes; corridor ZIP prefix is a prefilter.
- SANDAG FasTrak | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.myfastrak.511sd.com
  note: Secondary San Diego FasTrak account surface for SANDAG-operated I-15 Express Lanes and SR 125 Toll Road; ZIP prefixes are San Diego-region prefilters.

### CO

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Colorado, CenturyLink (Lumen), Denver Water, E-ZPass, ExpressToll, Google Fiber, RTD, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy Colorado, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Colorado, Aurora Water, Black Hills Energy Colorado, CenturyLink (Lumen), City of Boulder Utilities, City of Longmont Utilities, City of Loveland Utilities, City of Westminster Utilities, Colorado Springs Utilities, CORE Electric Cooperative, Denver Water, E-ZPass, ExpressToll, Fort Collins Utilities, Google Fiber, Holy Cross Energy, Poudre Valley REA, RTD, RTD Denver, Spectrum, Starlink, T-Mobile Home Internet, United Power, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy Colorado, Xfinity (Comcast)
- RTD Denver | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.rtd-denver.com/system-map
  note: Regional Transportation District is the core transit provider for Denver metro.
- E-470 Public Highway Authority | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.e470.com
  note: Toll facility authority folded into the existing ExpressToll account provider to avoid duplicate resident-facing toll account rows.
- Northwest Parkway | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.nwpky.com
  note: Toll road facility folded into ExpressToll for the resident-facing account and payment surface.
- Aurora Water | UTILITY_WATER | newly_added | live_address | https://www.auroragov.org/residents/water/pay_my_water_bill/home_sellers_buyers_checklist/general_escrow_request_and_transfer_of_ownership
  note: Aurora Water is city-scoped but address-specific, with ownership-transfer and billing workflows for eligible water accounts.
- City of Boulder Utilities | UTILITY_WATER | newly_added | live_address | https://bouldercolorado.gov/water-service-request-form
  note: Boulder water, wastewater, and stormwater billing is city-scoped but exact service should be confirmed by address.
- Colorado Springs Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.csu.org/my-account/start-stop-service
  note: Colorado Springs Utilities is a municipal multi-utility for electric, gas, water, and wastewater; ZIPs are city-area prefilters and service should be confirmed by address.
- Fort Collins Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://secure.fcgov.com/utilities-service-request/
  note: Fort Collins Utilities provides electric, water, wastewater, and stormwater service; exact eligibility should be confirmed by service address.
- Atmos Energy Colorado | UTILITY_GAS | already_present | live_address | https://www.atmosenergy.com/accountcenter/moveininf/bpMoveInStart.html
  note: Atmos Energy Colorado serves selected communities across northeastern, San Luis Valley, and southwest Colorado; ZIPs are prefilters and service must be confirmed by address.
- City and County of Denver Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Recycle-Compost-Trash
  note: Denver Solid Waste Management applies to eligible City and County of Denver residential service addresses, not the full metro.
- City of Westminster Utilities | UTILITY_WATER | newly_added | live_address | https://www.westminsterco.gov/184/Utility-Billing
  note: Westminster water, wastewater, stormwater, and utility billing are city-scoped; ZIPs are prefilters and service should be confirmed by address.
- CORE Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://core.coop/start-stop-service/
  note: CORE Electric Cooperative serves selected Front Range and foothills communities; exact membership/service should be confirmed by address.
- United Power | UTILITY_ELECTRIC | newly_added | live_address | https://www.unitedpower.com/start-transfer-stop
  note: United Power serves northern Front Range cooperative members; ZIPs are prefilters and service should be confirmed by address.
- Poudre Valley REA | UTILITY_ELECTRIC | newly_added | live_address | https://pvrea.coop/for-members/account-management/start-stop-service/
  note: Poudre Valley REA serves parts of Larimer, Weld, and Boulder counties; exact service should be confirmed by address.
- Holy Cross Energy | UTILITY_ELECTRIC | newly_added | live_address | https://www.holycross.com/account-services/services/service-requests/start-stop-transfer-service
  note: Holy Cross Energy serves selected western Colorado mountain communities; ZIPs are prefilters and service should be confirmed by address.
- City of Longmont Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://longmontcolorado.gov/utilities-and-public-works/utility-bill/start-or-stop-service/
  note: Longmont municipal utility billing covers city electric, water, sewer, and waste-management workflows; service should be confirmed by address.
- City of Loveland Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.lovelandwaterandpower.org/about-us/start-stop-or-move-service
  note: Loveland Water and Power is a municipal utility for Loveland service addresses; ZIPs are city prefilters and service should be confirmed by address.
- Colorado Natural Gas | UTILITY_GAS | catalog_backlog | live_address | https://www.coloradonaturalgas.com/service-areas
  note: Catalog-only backlog: official service-area workflow is address/map based, but the current candidate does not provide a reliable ZIP prefilter for resident-facing recommendations.

### CT

- Repo before: Aquarion Water Company of Connecticut, Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Eversource Energy, Frontier Communications, Optimum, Southern Connecticut Gas Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of Connecticut, Astound Broadband, AT&T Fiber, Connecticut Natural Gas, Connecticut Water Company, Cox Communications, E-ZPass, Eversource Energy, Frontier Communications, Groton Utilities, Jewett City Department of Public Utilities, Metropolitan District Commission, Norwich Public Utilities, Optimum, South Central Connecticut Regional Water Authority, Southern Connecticut Gas Company, Spectrum, Starlink, T-Mobile Home Internet, United Illuminating, Verizon 5G Home Internet, Verizon Fios, Wallingford Electric Division, WOW! Internet, Xfinity (Comcast)
- United Illuminating | UTILITY_ELECTRIC | newly_added | live_address | https://www.uinet.com/moving
  note: United Illuminating covers 17 towns in greater New Haven and Bridgeport; exact ZIPs are prefilters and service should be confirmed by address.
- Connecticut Natural Gas | UTILITY_GAS | newly_added | live_address | https://www.cngcorp.com/moving
  note: Connecticut Natural Gas serves central Connecticut and Greenwich gas customers; exact ZIPs are prefilters and service should be confirmed by address.
- Connecticut Water Company | UTILITY_WATER | newly_added | live_address | https://www.ctwater.com/service-billing/your-service/developer-projects-and-new-service-connections/
  note: Connecticut Water serves many non-contiguous towns; exact ZIPs are prefilters and water service should be confirmed by address.
- Access Health CT | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.accesshealthct.com
  note: Official Connecticut health marketplace account surface, modeled with Connecticut ZIP prefixes.
- HUSKY Health | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://portal.ct.gov/HUSKY
  note: Official Connecticut Medicaid/HUSKY health account surface, modeled with Connecticut ZIP prefixes.
- Connecticut Department of Revenue Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://portal.ct.gov/DRS
  note: Official Connecticut tax account/address surface, modeled with Connecticut ZIP prefixes.
- Jewett City Department of Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.jewettcitydpu.com
  note: Real municipal electric utility; modeled with CT 063 ZIP prefix and address confirmation language.
- Norwich Public Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://norwichpublicutilities.com
  note: Real Norwich municipal multi-utility; exact ZIPs are city prefilters and electric, gas, water, and sewer activation should be confirmed by address.
- Wallingford Electric Division | UTILITY_ELECTRIC | newly_added | live_address | https://www.wallingfordct.gov/government/departments/electric-division/
  note: Real municipal electric utility for Wallingford and part of Northford; exact ZIPs are prefilters and service should be confirmed by address.
- Groton Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://grotonutilities.com/221/Start-or-Stop-Service
  note: Groton Utilities is a municipal electric and water provider; exact ZIPs are prefilters and service should be confirmed by address.
- Bridgeport Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.bridgeportct.gov/government/departments/water-pollution-control-authority-wpca
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Greater New Haven Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://gnhwpca.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Stamford Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.stamfordct.gov/government/operations/water-pollution-control-authority
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Metropolitan District Commission | UTILITY_WATER | newly_added | live_address | https://themdc.org/
  note: Hartford-area regional water and sewer authority; ZIP prefixes are prefilters and service should be confirmed by property address.
- South Central Connecticut Regional Water Authority | UTILITY_WATER | newly_added | live_address | https://www.rwater.com/customer-care/start-or-stop-service
  note: South Central Connecticut RWA serves listed New Haven-area communities; exact ZIPs are prefilters and service should be confirmed by address.

### DE

- Repo before: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities, Delmarva Power, E-ZPass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities, City of Dover Electric Department, City of Milford Electric, City of Newark Electric, DART First State, Delaware E-ZPass, Delaware Electric Cooperative, Delmarva Power, E-ZPass, Lewes Board of Public Works Electric, Municipal Services Commission of the City of New Castle Electric, Spectrum, Starlink, T-Mobile Home Internet, Town of Middletown Electric, Town of Smyrna Electric, Verizon 5G Home Internet, Verizon Fios, Wilmington Water Utility, WOW! Internet, Xfinity (Comcast)
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

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Tampa Utilities, Cox Communications, Duke Energy Florida, E-ZPass, Florida Power & Light Company, Frontier Communications, JEA, Lynx, Miami-Dade Transit, Miami-Dade Water and Sewer Department, Orlando Utilities Commission, Peoples Gas Florida, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Tampa Utilities, Cox Communications, Duke Energy Florida, E-PASS / Central Florida Expressway Authority, E-ZPass, Florida City Gas, Florida Power & Light Company, Florida Public Utilities, Frontier Communications, Gainesville Regional Utilities, Greater Miami Expressway Agency, Hillsborough County Water Resources, I-4 Express, JEA, Kissimmee Utility Authority, Lakeland Electric, LeeWay, Lynx, Miami-Dade Transit, Miami-Dade Water and Sewer Department, Orange County Utilities Water, Orlando Utilities Commission, Palm Beach County Water Utilities Department, Peoples Gas Florida, Pinellas County Utilities, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Tampa Electric, Tampa Hillsborough Expressway Authority, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Tampa Electric | UTILITY_ELECTRIC | newly_added | live_address | https://www.tampaelectric.com/residential/start-service/
  note: Tampa Electric serves Hillsborough and parts of Pasco, Pinellas, and Polk counties; ZIP prefixes are Tampa Bay prefilters and service should be confirmed by address.
- Florida KidCare | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.floridakidcare.org
  note: Official Florida child health insurance account surface, modeled with Florida ZIP prefixes from Batch 1.
- Florida Medicaid / MyACCESS | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://myaccess.myflfamilies.com
  note: Official Florida benefits/Medicaid account surface, modeled with Florida ZIP prefixes from Batch 1.
- Florida DOR e-Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://floridarevenue.com
  note: Official Florida tax e-services account surface, modeled with Florida ZIP prefixes from Batch 1.
- E-PASS / Central Florida Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://epass.cfxway.com/
  note: Real Central Florida toll account provider; modeled around Orlando/Central Florida corridor ZIP prefixes and distinct from SunPass.
- Greater Miami Expressway Agency | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.gmx-way.com
  note: Real Miami-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- I-4 Express | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://i4express.com
  note: Real I-4 Express toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- Tampa Hillsborough Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.tampa-xway.com
  note: Real Tampa-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
- Florida City Gas | UTILITY_GAS | newly_added | live_address | https://www.floridacitygas.com/residential/start-stop-transfer-or-add/
  note: Florida City Gas serves South Florida and Treasure Coast pockets; ZIP prefixes are prefilters and gas service should be confirmed by address.
- Hillsborough County Water Resources | UTILITY_WATER | newly_added | zip_prefix | https://hcfl.gov/residents/property-owners-and-renters/water-and-sewer/request-to-start-stop-or-move-water-service
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Miami-Dade Solid Waste Management | UTILITY_TRASH | newly_added | zip_prefix | https://www.miamidade.gov/solidwaste
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Orange County Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.orangecountyfl.net/WaterGarbageRecycling.aspx
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Palm Beach County Water Utilities Department | UTILITY_WATER | newly_added | zip_prefix | https://discover.pbcgov.org/waterutilities
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Pinellas County Utilities | UTILITY_WATER | newly_added | zip_prefix | https://pinellas.gov/services/request-utilities-service/
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
- Florida Public Utilities | UTILITY_GAS | newly_added | live_address | https://fpuc.com/customer-care/start-stop-transfer-service/
  note: Florida Public Utilities provides natural gas across parts of 25 Florida counties and electric service in selected Northeast/Northwest Florida areas; ZIP prefixes are a prefilter and service address confirmation is required.
- Lakeland Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://lakelandelectric.com/billing-and-payment/moving
  note: Lakeland Electric is a municipal electric utility for Lakeland-area customers; ZIP prefix is a prefilter and service address confirmation is required.
- Kissimmee Utility Authority | UTILITY_ELECTRIC | newly_added | zip_prefix | https://kua.com/contact-information/contact-kua/
  note: KUA serves Kissimmee and surrounding Osceola County electric customers; ZIP prefix is a prefilter and service address confirmation is required.
- Gainesville Regional Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.gru.com
  note: GRU is Gainesville's multi-service municipal utility for electric, natural gas, water, wastewater, and telecom; ZIP prefix is a prefilter and service address confirmation is required.
- LeeWay | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.leegov.com/tolls
  note: LeeWay is Lee County's toll account/transponder service for local bridge toll facilities; exact ZIPs focus on Lee County and Bonita Springs service-area prefilters.

### GA

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Atlanta Department of Watershed Management, Cox Communications, E-ZPass, Georgia Natural Gas, Georgia Power, Google Fiber, MARTA, Peach Pass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atlanta Gas Light, CenturyLink (Lumen), City of Atlanta Department of Watershed Management, Cobb County Water System, Cobb EMC, Cox Communications, DeKalb County Department of Watershed Management, E-ZPass, Fulton County Water Services, Gas South, Georgia Natural Gas, Georgia Power, Google Fiber, Gwinnett County Department of Water Resources, Marietta Power and Water, MARTA, Peach Pass, Sawnee EMC, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Georgia Department of Revenue Motor Vehicle Division | GOVERNMENT_DMV | newly_added | state | https://dor.georgia.gov/change-address-registration
  note: Georgia DOR Motor Vehicle Division handles vehicle registration, title, DRIVES e-Services, and vehicle registration address changes; it complements DDS driver license records.
- Atlanta Gas Light | UTILITY_GAS | newly_added | live_address | https://www.atlantagaslight.com/residential/start-stop-service.html
  note: Atlanta Gas Light is Georgia's gas delivery utility for many service areas; retail enrollment happens through certified marketers and availability should be confirmed by service address.
- Gas South | UTILITY_GAS | newly_added | live_address | https://www.gassouth.com/move-transfer-service
  note: Gas South is a Georgia retail natural gas marketer; ZIPs are gas-market prefilters and service should be confirmed by address and Atlanta Gas Light meter availability.
- Cobb EMC | UTILITY_ELECTRIC | newly_added | live_address | https://www.cobbemc.com/start-stop-or-transfer-service
  note: Cobb EMC is a northwest metro Atlanta electric cooperative; exact ZIPs are prefilters and service must be confirmed with the address finder.
- Sawnee EMC | UTILITY_ELECTRIC | newly_added | live_address | https://sawnee.coop/start-or-stop-service
  note: Sawnee EMC serves parts of northern Georgia counties; exact ZIPs are prefilters and service should be confirmed by address.
- Marietta Power and Water | UTILITY_ELECTRIC | newly_added | live_address | https://www.mariettaga.gov/431/Start-or-Stop-Your-Service
  note: Marietta Power and Water is a municipal electric and water utility; exact ZIPs are Marietta-area prefilters and service should be confirmed by address.
- Fulton County Water Services | UTILITY_WATER | newly_added | live_address | https://www.fultoncountyga.gov/services/water-services/start-your-water-service
  note: Fulton County Water Services covers county water/sewer service areas outside City of Atlanta; exact ZIPs are prefilters and service should be confirmed by address.
- DeKalb County Department of Watershed Management | UTILITY_WATER | newly_added | live_address | https://dekalbcountyga.gov/departments/watershed-management
  note: DeKalb County Watershed handles water and sewer account workflows; exact ZIPs are county prefilters and service should be confirmed by address.
- Gwinnett County Department of Water Resources | UTILITY_WATER | newly_added | live_address | https://www.gwinnettcounty.com/government/departments/water
  note: Gwinnett County Water Resources supports start, stop, transfer, billing, and customer care workflows; exact ZIPs are prefilters.
- Cobb County Water System | UTILITY_WATER | newly_added | live_address | https://www.cobbcounty.gov/water/customers/setup-service
  note: Cobb County Water System is distinct from Marietta Power and Water; exact ZIPs are county prefilters and service should be confirmed by address.
- DeKalb County Sanitation Division | UTILITY_TRASH | newly_added | live_address | https://dekalbcountyga.gov/departments/public-works/sanitation/new-residential-service
  note: DeKalb County Sanitation handles trash, recycling, and yard trimmings separately from DeKalb Watershed water/sewer service.
- Gwinnett County Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://www.gwinnettcounty.com/services/solid-waste-management/start-service
  note: Gwinnett County manages the residential trash and recycling service framework; exact ZIPs are county prefilters and enrollment is address-based.
- City of Atlanta Office of Solid Waste Services | UTILITY_TRASH | newly_added | live_address | https://www.atlantaga.gov/government/departments/public-works/office-of-solid-waste-services
  note: Atlanta Solid Waste Services handles garbage, recycling, and yard waste separately from Atlanta Watershed water/sewer accounts.

### HI

- Repo before: Astound Broadband, AT&T Fiber, Board of Water Supply, City and County of Honolulu, E-ZPass, Hawaii Gas, Hawaiian Electric Company, Hawaiian Telcom, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Board of Water Supply, City and County of Honolulu, Department of Water Supply, County of Hawaii, Department of Water Supply, County of Maui, Department of Water, County of Kauai, E-ZPass, Hawaii Electric Light Company, Hawaii Gas, Hawaiian Electric Company, Hawaiian Telcom, Kauai Island Utility Cooperative, Maui Electric Company, Skyline, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Skyline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.honolulu.gov/skyline
  note: Honolulu Skyline adds a rail-specific transit surface beyond TheBus.
- City and County of Honolulu Division of Motor Vehicles, Licensing and Permits | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.honolulu.gov/csd/vehicle/
  note: Hawaii DMV services are county-run; this Oahu surface is exact-ZIP scoped to Honolulu County rather than statewide.
- Maui County Division of Motor Vehicles & Licensing | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.mauicounty.gov/1328/DMV
  note: Maui County runs its own driver licensing and motor vehicle workflows; modeled with exact Maui County ZIPs.
- County of Hawaii Vehicle Registration & Licensing Division | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.vrl.hawaiicounty.gov/motor-vehicle-registration
  note: County of Hawaii operates a separate Big Island vehicle registration and licensing surface; modeled with exact Hawaii County ZIPs.
- County of Kauai Division of Motor Vehicles | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.kauai.gov/Government/Departments-Agencies/Finance/Drivers-Licensing-and-Motor-Vehicles
  note: Kauai County runs separate driver licensing and motor vehicle services; modeled with exact Kauai County ZIPs.
- Maui Electric Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hawaiianelectric.com/customer-service/maui-county-directory
  note: Maui Electric is the Maui County operating surface for Maui, Molokai, and Lanai; exact ZIPs are a prefilter and service address confirmation is required.
- Hawaii Electric Light Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hawaiianelectric.com/customer-service/hawaii-island-directory
  note: Hawaii Electric Light serves Hawaii Island; exact ZIPs are a prefilter and service address confirmation is required.
- Kauai Island Utility Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://kiuc.coop/start-or-stop-service
  note: KIUC is the separate Kauai electric cooperative; exact ZIPs are a prefilter and service address confirmation is required.
- Department of Water Supply, County of Maui | UTILITY_WATER | newly_added | zip_prefix | https://www.mauicounty.gov/215/Fiscal-Division
  note: Maui County water customer service handles account, billing, start, stop, and transfer inquiries; exact ZIPs are a prefilter and service address confirmation is required.
- Department of Water Supply, County of Hawaii | UTILITY_WATER | newly_added | zip_prefix | https://customerconnect.hawaiidws.org/moving/start-service
  note: County of Hawaii DWS provides a start-service workflow and district customer service lines; exact ZIPs are a prefilter and service address confirmation is required.
- Department of Water, County of Kauai | UTILITY_WATER | newly_added | zip_prefix | https://www.kauaiwater.org/sign-up-or-transfer-water-service/
  note: Kauai Department of Water provides sign-up and transfer workflows; exact ZIPs are a prefilter and service address confirmation is required.
- Hawaii Department of Taxation | GOVERNMENT_TAX | newly_added | state | https://tax.hawaii.gov/faq/
  note: Official Hawaii state tax account and address-change surface; statewide for Hawaii residents and businesses.
- Hawaii Med-QUEST / KOLEA | GOVERNMENT_HEALTH | newly_added | state | https://medquest.hawaii.gov/en/members-applicants/already-covered/change-update-information.html
  note: Official Hawaii Medicaid/Med-QUEST account surface for reporting address and household changes through KOLEA or Med-QUEST support.

### ID

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, Enbridge Gas Utah, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, CenturyLink (Lumen), Cox Communications, E-ZPass, Enbridge Gas Utah, Idaho Power, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Idaho Power | UTILITY_ELECTRIC | newly_added | state | https://www.idahopower.com
  note: Idaho Power is the dominant investor-owned electric utility in southern Idaho and a major catalog gap.
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.

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

- Repo before: Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities, Delmarva Power, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- Repo after: Anne Arundel County Bureau of Utility Operations, Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities, Choptank Electric Cooperative, Columbia Gas of Maryland, Delmarva Power, DriveEzMD, E-ZPass, Howard County Bureau of Utilities, Maryland American Water, MTA Maryland, Pepco, Potomac Edison, Southern Maryland Electric Cooperative, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- MTA Maryland | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.mta.maryland.gov/transit-maps
  note: Maryland Transit Administration adds a missing Baltimore-centric transit surface.
- DriveEzMD | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://driveezmd.com/sign-up/
  note: Maryland toll account surface for E-ZPass, Pay-By-Plate, and Video Toll activity; distinct from MDOT MVA driver/vehicle services.
- Potomac Edison | UTILITY_ELECTRIC | newly_added | live_address | https://www.firstenergycorp.com/potomac_edison.html
  note: Potomac Edison serves western Maryland and parts of West Virginia; ZIP prefixes are a prefilter and service address confirmation is required.
- Southern Maryland Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.smeco.coop/my-account/service-management/connect-service/
  note: SMECO serves Southern Maryland including Charles, St. Mary's, southern Prince George's, and most of Calvert County; ZIP prefixes are a prefilter and service address confirmation is required.
- Choptank Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://choptankelectric.coop/apply-service
  note: Choptank Electric Cooperative serves rural and suburban Maryland Eastern Shore communities; ZIP prefixes are a prefilter and service address confirmation is required.
- Columbia Gas of Maryland | UTILITY_GAS | newly_added | live_address | https://www.columbiagasmd.com/services/start-stop-or-move-service
  note: Columbia Gas of Maryland serves Garrett, Allegany, and Washington counties in western Maryland; ZIP prefixes are a prefilter and service address confirmation is required.
- Anne Arundel County Bureau of Utility Operations | UTILITY_WATER | newly_added | live_address | https://www.aacounty.org/services/sewer-water
  note: Anne Arundel County water and wastewater service is county-scoped but address-specific; exact ZIPs are prefilters only.
- Howard County Bureau of Utilities | UTILITY_WATER | newly_added | live_address | https://www.howardcountymd.gov/public-works/bureau-utilities
  note: Howard County public water and wastewater service covers most, but not all, county residents; exact ZIPs are prefilters and address confirmation is required.
- Maryland American Water | UTILITY_WATER | newly_added | live_address | https://amwater.com/mdaw/
  note: Maryland American Water has a small, non-contiguous footprint around Bel Air, Harford County, and Severn; exact ZIPs are conservative prefilters and service must be confirmed by address.
- Prince George's County Residential Collections | UTILITY_TRASH | newly_added | live_address | https://www.princegeorgescountymd.gov/departments-offices/environment/waste-recycling/residential-collections
  note: Prince George's County residential collection applies to county-contracted collection areas; exact ZIPs are prefilters and address eligibility should be confirmed.
- Baltimore County Bureau of Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://www.baltimorecountymd.gov/departments/public-works/solid-waste
  note: Baltimore County solid waste collection is county-scoped and distinct from Baltimore City sanitation; exact ZIPs are prefilters and address eligibility should be confirmed.

### MA

- Repo before: Astound Broadband, AT&T Fiber, Boston Water and Sewer Commission, E-ZPass, Eversource Energy, MBTA, National Grid Massachusetts, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of Massachusetts, Astound Broadband, AT&T Fiber, Berkshire Gas Company, Boston Water and Sewer Commission, Braintree Electric Light Department, Chicopee Electric Light, City of Cambridge Water Department, City of Somerville Water and Sewer Department, City of Worcester Water and Sewer Operations, E-ZPass, Eversource Energy, EZDriveMA / E-ZPass MA, Holyoke Gas and Electric, Liberty Utilities Massachusetts Gas, Massachusetts Water Resources Authority, MBTA, National Grid Massachusetts, Peabody Municipal Light Plant, Reading Municipal Light Department, Spectrum, Springfield Water and Sewer Commission, Starlink, T-Mobile Home Internet, Taunton Municipal Lighting Plant, Unitil Massachusetts, Verizon 5G Home Internet, Verizon Fios, Westfield Gas and Electric, WOW! Internet, Xfinity (Comcast)
- Massachusetts Water Resources Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.mwra.com
  note: MWRA covers Boston-region wholesale water/sewer service and adds a missing Massachusetts water surface.
- EZDriveMA / E-ZPass MA | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.mass.gov/ezdrivema
  note: Massachusetts toll account surface for E-ZPass MA and Pay By Plate; ZIP prefixes are Mass Pike and Boston-area toll corridor prefilters.
- Unitil Massachusetts | UTILITY_ELECTRIC | newly_added | zip_prefix | https://unitil.com/account-billing/start-stop-or-move-service
  note: Unitil serves specific Massachusetts electric and gas towns around Fitchburg/Gardner; exact ZIPs are a prefilter and service address confirmation is required.
- Berkshire Gas Company | UTILITY_GAS | newly_added | zip_prefix | https://www.berkshiregas.com/moving
  note: Berkshire Gas serves selected western Massachusetts communities; exact ZIPs are a prefilter and service address confirmation is required.
- Liberty Utilities Massachusetts Gas | UTILITY_GAS | newly_added | zip_prefix | https://massachusetts.libertyutilities.com/fall-river/residential/my-account/moving.html
  note: Liberty Massachusetts Gas serves localized Fall River and Blackstone-area gas territories; exact ZIPs are a prefilter and service address confirmation is required.
- Aquarion Water Company of Massachusetts | UTILITY_WATER | newly_added | zip_prefix | https://www.aquarionwater.com/customer-care/start-or-stop-service
  note: Aquarion Water Company of Massachusetts serves selected Massachusetts communities including parts of Dover, Millbury, Oxford, Plymouth, and Sheffield; exact ZIPs are a prefilter.
- Springfield Water and Sewer Commission | UTILITY_WATER | newly_added | zip_prefix | https://waterandsewer.org/request-service/
  note: Springfield Water and Sewer Commission serves Springfield and Ludlow-area water/sewer customers; exact ZIPs are a prefilter and service address confirmation is required.
- City of Worcester Water and Sewer Operations | UTILITY_WATER | newly_added | zip_prefix | https://www.worcesterma.gov/water-sewer
  note: Worcester municipal water and sewer operations are city-scoped; exact ZIPs prevent statewide UI expansion.
- City of Cambridge Water Department | UTILITY_WATER | newly_added | zip_prefix | https://www.cambridgema.gov/departments/waterdepartment
  note: Cambridge Water Department is a city-owned water utility; exact ZIPs prevent Boston-area overmatching.
- City of Somerville Water and Sewer Department | UTILITY_WATER | newly_added | zip_prefix | https://www.somervillema.gov/departments/water-and-sewer
  note: Somerville water/sewer billing and final bill workflows are city-scoped; exact ZIPs prevent Boston-area overmatching.
- Holyoke Gas and Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hged.com/residential/start-stop-move-upgrade.aspx
  note: HG&E is the municipal electric/gas utility for Holyoke; exact ZIPs keep this local provider off unrelated Massachusetts moves.
- Westfield Gas and Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.wgeld.org/forms/residential-start-stop-service/
  note: WG+E is the city-owned Westfield gas and electric utility; exact ZIPs keep it local.
- Peabody Municipal Light Plant | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pmlp.com/235/Sign-Up-for-Electrical-Service
  note: PMLP serves Peabody and South Lynnfield electric customers; exact ZIPs keep it local.
- Taunton Municipal Lighting Plant | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.tmlp.com/162/Stop-Start-Service
  note: TMLP serves Taunton, Raynham, Berkley, and selected nearby areas; exact ZIPs are a local prefilter.
- Reading Municipal Light Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.rmld.com/291/Start-or-Stop-Service
  note: RMLD serves Reading, North Reading, Wilmington, and Lynnfield Center; exact ZIPs keep it local.
- Chicopee Electric Light | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.celd.com/application-for-service
  note: Chicopee Electric Light is the municipal electric utility for Chicopee; exact ZIPs keep it local.
- Braintree Electric Light Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.beld.com/
  note: BELD is the municipal electric utility for Braintree; exact ZIPs keep it local.
- City of Boston Public Works Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.boston.gov/departments/public-works/trash-and-recycling-day-schedule-and-search
  note: Boston trash and recycling schedule lookup is city-scoped; exact ZIPs prevent statewide display.
- City of Cambridge Curbside Collections | UTILITY_TRASH | newly_added | zip_prefix | https://www.cambridgema.gov/services/curbsidecollections
  note: Cambridge curbside trash, recycling, food waste, and yard waste service is city-scoped; exact ZIPs keep it local.
- City of Worcester Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.worcesterma.gov/trash-recycling
  note: Worcester trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
- City of Somerville Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.somervillema.gov/trash-and-recycling
  note: Somerville trash and recycling schedule is city-scoped; exact ZIPs keep it local.

### MI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, SMART, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- SMART | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.smartbus.org/Routes-Schedules/System-Map
  note: Suburban Mobility Authority for Regional Transportation adds the Detroit suburban network missing from seed.

### MN

- Repo before: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Minnesota Energy Resources, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
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

- Repo before: Astound Broadband, AT&T Fiber, Consolidated Communications VT, E-ZPass, Eversource Energy New Hampshire Electric, Liberty Utilities New Hampshire Electric, Pennichuck Water Works, Spectrum, Starlink, T-Mobile Home Internet, Unitil Northern Utilities New Hampshire Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of New Hampshire, Astound Broadband, AT&T Fiber, City of Concord General Services Water and Sewer Utility Billing, COAST, Consolidated Communications VT, E-ZPass, Eversource Energy New Hampshire Electric, Hampstead Area Water Company, Liberty Utilities New Hampshire Electric, Liberty Utilities New Hampshire Gas, Manchester Water Works, New Hampshire Electric Cooperative, NH E-ZPass / New Hampshire Turnpike System, Pennichuck Water Works, Spectrum, Starlink, T-Mobile Home Internet, Unitil Energy Systems New Hampshire Electric, Unitil Northern Utilities New Hampshire Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- COAST | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://coastbus.org/schedules
  note: COAST adds a New Hampshire transit provider for the Seacoast region.
- NH E-ZPass / New Hampshire Turnpike System | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ezpassnh.com/
  note: New Hampshire toll account and transponder surface; corridor ZIP prefixes keep it focused around NH Turnpike travel rather than every NH move.
- Unitil Energy Systems New Hampshire Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://unitil.com/account-billing/start-stop-or-move-service
  note: Unitil New Hampshire electric service is town and partial-town scoped; exact ZIPs are a prefilter and service address confirmation is required.
- New Hampshire Electric Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.nhec.com/request-service/
  note: NHEC is a member-owned electric cooperative serving many rural NH communities; exact ZIPs are a prefilter and service address confirmation is required.
- Liberty Utilities New Hampshire Gas | UTILITY_GAS | newly_added | zip_prefix | https://new-hampshire.libertyutilities.com/pelham/residential/contact/service-requests/
  note: Liberty EnergyNorth natural gas service is separate from Liberty electric and should be confirmed by service address.
- Aquarion Water Company of New Hampshire | UTILITY_WATER | newly_added | zip_prefix | https://www.aquarionwater.com/customer-care/start-or-stop-service
  note: Aquarion's New Hampshire water communities are split from the Connecticut record; exact ZIPs are a prefilter and service address confirmation is required.
- Hampstead Area Water Company | UTILITY_WATER | newly_added | zip_prefix | https://www.hampsteadwater.com/new-service
  note: Hampstead Area Water serves selected southern NH towns and subdivisions; exact ZIPs are a prefilter and service address confirmation is required.
- Manchester Water Works | UTILITY_WATER | newly_added | zip_prefix | https://manchesterwater.org/start%2Fstop-service
  note: Manchester Water Works is city-scoped; exact ZIPs prevent statewide display.
- City of Manchester Sewer and Stormwater | UTILITY_SEWER | newly_added | zip_prefix | https://www.manchesternh.gov/Departments/sewer-and-stormwater
  note: Manchester sewer and stormwater billing is city-scoped and separate from water account support.
- City of Manchester Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.manchesternh.gov/Departments/Trash-and-Recycling/Trash-Collection
  note: Manchester trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
- City of Concord General Services Water and Sewer Utility Billing | UTILITY_WATER | newly_added | zip_prefix | https://www.concordnh.gov/1339/Utility-Billing
  note: Concord water and sewer utility billing is city-scoped; exact ZIPs prevent statewide display.
- City of Concord Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.concordnh.gov/536/Trash-Recycling
  note: Concord trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
- City of Nashua Solid Waste Department | UTILITY_TRASH | newly_added | zip_prefix | https://www.nashuanh.gov/441/Residential-Collections
  note: Nashua solid waste collection is city-scoped; exact ZIPs prevent statewide display.
- City of Nashua Wastewater Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.nashuanh.gov/392/Wastewater-Department
  note: Nashua wastewater support is city-scoped and separate from Pennichuck water service.

### NJ

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Delaware River Joint Toll Bridge Commission, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, Orange & Rockland, PATCO Speedline, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.
- Orange & Rockland | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oru.com
  note: Orange & Rockland serves Orange, Rockland, and Sullivan counties in New York plus northern New Jersey through Rockland Electric; ZIP prefixes are a prefilter and service address confirmation is required.
- Delaware River Joint Toll Bridge Commission | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.drjtbc.org/e-zpass/
  note: DRJTBC toll facilities are concentrated on Delaware River crossings between eastern Pennsylvania and New Jersey; account servicing is handled by the NJ E-ZPass customer service center.

### NM

- Repo before: Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: ABQ RIDE, Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, El Paso Electric, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- ABQ RIDE | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cabq.gov/transit/routes-and-schedules/system-map
  note: Albuquerque transit addition for New Mexico.
- El Paso Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.epelectric.com
  note: El Paso Electric serves the El Paso, Texas and southern New Mexico region; ZIP prefixes are a prefilter and service address confirmation is required.

### NY

- Repo before: Astound Broadband, AT&T Fiber, Con Edison, E-ZPass, Frontier Communications, MTA, National Grid Upstate New York, NY E-ZPass, NYC Water Board, Optimum, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Central Hudson Gas & Electric, Con Edison, E-ZPass, Frontier Communications, MTA, National Fuel Gas Distribution Corporation, National Grid Metro New York Gas, National Grid Upstate New York, New York State Electric & Gas, NY E-ZPass, NYC Water Board, Optimum, Orange & Rockland, PSEG Long Island, Rochester Gas & Electric, Spectrum, Spectrum Maine, Starlink, Suffolk County Water Authority, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PSEG Long Island | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.psegliny.com
  note: Long Island electric utility surface missing from the seed's New York coverage.
- National Grid Metro New York Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalgridus.com/NY-Home
  note: National Grid Metro/Downstate gas serves Brooklyn, Queens, Staten Island, and Long Island; ZIP prefixes are a prefilter because gas territory varies by borough/neighborhood and service address.
- Central Hudson Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cenhud.com
  note: Central Hudson serves a defined Mid-Hudson Valley territory from the northern NYC suburbs toward the Capital District; ZIP prefixes are a prefilter and service address confirmation is required.
- Orange & Rockland | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oru.com
  note: Orange & Rockland serves Orange, Rockland, and Sullivan counties in New York plus northern New Jersey through Rockland Electric; ZIP prefixes are a prefilter and service address confirmation is required.
- New York State Electric & Gas | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.nyseg.com
  note: NYSEG serves more than 40% of upstate New York across many counties; ZIP prefixes are a broad prefilter and service address confirmation is required.
- Rochester Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.rge.com
  note: RG&E serves a nine-county Rochester-centered electric and gas territory; ZIP prefixes are a prefilter and service address confirmation is required.
- National Fuel Gas Distribution Corporation | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalfuel.com/utility/
  note: National Fuel Gas Distribution serves western New York and northwestern Pennsylvania natural gas customers; ZIP prefixes are a prefilter and service address confirmation is required.
- Suffolk County Water Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.scwa.com
  note: SCWA serves Suffolk County water customers; ZIP prefixes are a prefilter and service address confirmation is required.

### NC

- Repo before: Aqua North Carolina, Astound Broadband, AT&T Fiber, Blue Ridge Energy, Brunswick Electric Membership Corporation, Carolina Water Service of North Carolina, CenturyLink (Lumen), Charlotte Water, City of Durham Department of Water Management, Dominion Energy North Carolina, Duke Energy North Carolina, E-ZPass, Enbridge Gas North Carolina, EnergyUnited, Frontier Natural Gas Company, Google Fiber, GoRaleigh, GoTriangle, Greensboro Water Resources, NC Quick Pass, Old North State Water Company, Orange Water and Sewer Authority, Piedmont Natural Gas, Raleigh Water, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Winston-Salem/Forsyth County Utilities, WOW! Internet, Xfinity (Comcast)
- Repo after: Aqua North Carolina, Astound Broadband, AT&T Fiber, Blue Ridge Energy, Brunswick Electric Membership Corporation, Carolina Water Service of North Carolina, CenturyLink (Lumen), Charlotte Water, City of Durham Department of Water Management, Dominion Energy North Carolina, Duke Energy North Carolina, E-ZPass, Enbridge Gas North Carolina, EnergyUnited, Frontier Natural Gas Company, Google Fiber, GoRaleigh, GoTriangle, Greensboro Water Resources, NC Quick Pass, Old North State Water Company, Orange Water and Sewer Authority, Piedmont Natural Gas, Raleigh Water, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Winston-Salem/Forsyth County Utilities, WOW! Internet, Xfinity (Comcast)
- External catalog: none

### ND

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Montana-Dakota Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.

### OH

- Repo before: AEP Ohio, AES Ohio, Astound Broadband, AT&T Fiber, CenterPoint Energy Ohio, CenturyLink (Lumen), City of Columbus Water & Power, City of Toledo Department of Public Utilities, Cleveland Public Power, Cleveland Water Department, Columbia Gas of Ohio, COTA, Cox Communications, Duke Energy Ohio, E-ZPass, Enbridge Gas Ohio, FirstEnergy Ohio Utilities, Frontier Communications, Greater Cincinnati Water Works, Ohio Turnpike E-ZPass, RTA Cleveland, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: AEP Ohio, AES Ohio, Astound Broadband, AT&T Fiber, CenterPoint Energy Ohio, CenturyLink (Lumen), City of Columbus Water & Power, City of Toledo Department of Public Utilities, Cleveland Public Power, Cleveland Water Department, Columbia Gas of Ohio, COTA, Cox Communications, Duke Energy Ohio, E-ZPass, Enbridge Gas Ohio, FirstEnergy Ohio Utilities, Frontier Communications, Greater Cincinnati Water Works, Ohio Turnpike E-ZPass, RTA Cleveland, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- External catalog: none

### OK

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, EMBARK, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- EMBARK | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://embarkok.com/system-map/
  note: Oklahoma City EMBARK adds a missing Oklahoma transit provider.

### OR

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, NW Natural, Portland General Electric, Portland Water Bureau, Spectrum, Starlink, T-Mobile Home Internet, TriMet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, NW Natural, Pacific Power, Portland General Electric, Portland Water Bureau, Spectrum, Starlink, T-Mobile Home Internet, TriMet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Pacific Power | UTILITY_ELECTRIC | newly_added | state | https://www.pacificpower.net/about.html
  note: Pacific Power is a major Oregon utility missing from seed.
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.

### PA

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, PECO Energy, Pennsylvania Turnpike Commission E-ZPass, Philadelphia Water Department, Pittsburgh Regional Transit, Pittsburgh Water & Sewer, PPL Electric Utilities, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aqua Pennsylvania, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Columbia Gas of Pennsylvania, Delaware River Joint Toll Bridge Commission, Duquesne Light Company, E-ZPass, Frontier Communications, Met-Ed, National Fuel Gas Distribution Corporation, PATCO Speedline, PECO Energy, Penelec, Penn Power, Pennsylvania American Water, Pennsylvania Turnpike Commission E-ZPass, Peoples Natural Gas, Philadelphia Gas Works, Philadelphia Water Department, Pittsburgh Regional Transit, Pittsburgh Water & Sewer, PPL Electric Utilities, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, West Penn Power, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.
- Columbia Gas of Pennsylvania | UTILITY_GAS | newly_added | zip_prefix | https://www.columbiagaspa.com
  note: Columbia Gas of Pennsylvania serves selected Pennsylvania communities; ZIP prefixes are a prefilter and service availability should be confirmed by address.
- National Fuel Gas Distribution Corporation | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalfuel.com/utility/
  note: National Fuel Gas Distribution serves western New York and northwestern Pennsylvania natural gas customers; ZIP prefixes are a prefilter and service address confirmation is required.
- Duquesne Light Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://duquesnelight.com/service-reliability
  note: Duquesne Light serves Allegheny and Beaver counties; ZIP prefixes are a prefilter and service address confirmation is required.
- Met-Ed | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/met_edison.html
  note: Met-Ed is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
- Penelec | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/penelec.html
  note: Penelec is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
- Penn Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/penn_power.html
  note: Penn Power is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
- West Penn Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/west_penn_power.html
  note: West Penn Power is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
- Peoples Natural Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.peoples-gas.com/my-account/start-or-modify-gas-service
  note: Peoples Natural Gas serves parts of western Pennsylvania; ZIP prefixes are a prefilter and service availability should be confirmed by address.
- Philadelphia Gas Works | UTILITY_GAS | newly_added | zip_prefix | https://www.pgworks.com/customer-care/your-home/service
  note: Philadelphia Gas Works is city-scoped to Philadelphia natural gas customers.
- Aqua Pennsylvania | UTILITY_WATER | newly_added | live_address | https://www.aquawater.com/start-or-stop-service
  note: Aqua Pennsylvania has a fragmented water and wastewater footprint across Pennsylvania, so service should be confirmed by address.
- Pennsylvania American Water | UTILITY_WATER | newly_added | live_address | https://www.amwater.com/paaw/customer-service-billing/
  note: Pennsylvania American Water serves many non-contiguous water and wastewater communities, so service should be confirmed by address.
- Delaware River Joint Toll Bridge Commission | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.drjtbc.org/e-zpass/
  note: DRJTBC toll facilities are concentrated on Delaware River crossings between eastern Pennsylvania and New Jersey; account servicing is handled by the NJ E-ZPass customer service center.

### RI

- Repo before: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, RIPTA, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RIPTA | TRANSPORTATION_TRANSIT | newly_added | state | https://ripta.com/statewide-system-map/
  note: RIPTA provides statewide Rhode Island transit service and should exist explicitly in seed.

### SC

- Repo before: Astound Broadband, AT&T Fiber, Charleston Water System, Dominion Energy South Carolina, Dominion Energy South Carolina Gas, E-ZPass, Piedmont Natural Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CARTA, Charleston Water System, Dominion Energy South Carolina, Dominion Energy South Carolina Gas, E-ZPass, Piedmont Natural Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
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
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy, Austin Energy, Austin Water, CapMetro, CenterPoint Energy, CenturyLink (Lumen), CPS Energy, Dallas Water Utilities, DART, E-ZPass, El Paso Electric, El Paso Water, Fort Worth Water, Frontier Communications, Google Fiber, Harris County Toll Road Authority, Houston METRO, Houston Public Works, North Texas Tollway Authority, Reliant Energy, San Antonio Water System, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Texas Gas Service, Trinity Metro, TxTag, TXU Energy, Verizon 5G Home Internet, Verizon Fios, VIA Metropolitan Transit, WOW! Internet, Xfinity (Comcast)
- North Texas Tollway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ntta.org
  note: NTTA adds a Dallas-Fort Worth toll corridor provider beyond statewide Texas toll tags.
- Oncor Electric Delivery | UTILITY_ELECTRIC | catalog_backlog | polygon | https://www.oncor.com
  note: Oncor is a critical Texas delivery utility, but its territory should be polygon-modeled rather than blindly state-scoped.
- Texas Department of Motor Vehicles | GOVERNMENT_DMV | newly_added | state | https://www.txdmv.gov
  note: Official Texas vehicle title, registration, registration-address, and county tax office resource; complements Texas DPS driver-license coverage.
- Harris County Toll Road Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.hctra.org
  note: HCTRA is a Houston/Harris County toll account provider; ZIP prefixes are a prefilter and account/vehicle details must be confirmed.
- Austin Energy | UTILITY_ELECTRIC | newly_added | zip_prefix | https://austinenergy.com
  note: Austin Energy serves Austin plus portions of Travis and Williamson counties; ZIP prefixes are a prefilter and service address confirmation is required.
- CPS Energy | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cpsenergy.com
  note: CPS Energy serves San Antonio and portions of adjoining counties for electric and gas service; ZIP prefixes are a prefilter and service address confirmation is required.
- Fort Worth Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fortworthtexas.gov/departments/water
  note: Fort Worth Water provides water and wastewater service in Fort Worth plus wholesale service around Tarrant-area communities; address confirmation is required.
- El Paso Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.epelectric.com
  note: El Paso Electric serves the El Paso, Texas and southern New Mexico region; ZIP prefixes are a prefilter and service address confirmation is required.
- El Paso Water | UTILITY_WATER | newly_added | zip_prefix | https://www.epwater.org
  note: El Paso Water is city/region-scoped; ZIP prefixes are a prefilter and service address confirmation is required.
- Texas Gas Service | UTILITY_GAS | newly_added | zip_prefix | https://www.texasgasservice.com
  note: Texas Gas Service serves specific Texas communities across Central Gulf, North Texas, Rio Grande Valley, and West Texas areas; ZIP prefixes are a prefilter and service address confirmation is required.

### UT

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Enbridge Gas Utah, Google Fiber, Rocky Mountain Power, Salt Lake City Department of Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of St. George Utilities, E-ZPass, Enbridge Gas Utah, Google Fiber, Provo City Utilities, Rocky Mountain Power, Salt Lake City Department of Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UDOT Express Pass, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- UDOT Express Pass | TRANSPORTATION_TOLL | newly_added | polygon | https://www.expresspass.utah.gov/
  note: Utah Express Pass is the I-15 Express Lanes toll account/transponder surface; ZIPs are Wasatch Front corridor prefilters rather than statewide coverage.
- Utah DMV Motor Vehicle Portal | GOVERNMENT_DMV | newly_added | state | https://mvp.tax.utah.gov/
  note: Separate statewide vehicle title, registration, renewal, and vehicle-address-change workflow; paired with Utah Driver License Division rather than replacing it.
- Provo City Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.provo.gov/181/City-Utilities
  note: Provo utility setup is municipal and address-specific; ZIPs are city prefilters for electric, water, wastewater, and garbage account setup.
- City of St. George Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://sgcityutah.gov/departments/apply_for_utility_services.php
  note: City utility application covers most St. George electric, water, sewer, and garbage service addresses; ZIPs are local prefilters.
- Wasatch Front Waste & Recycling District | UTILITY_TRASH | newly_added | live_address | https://wfwrdutah.gov/services-and-request/services-requests
  note: WFWRD serves selected Salt Lake County cities and unincorporated areas; ZIPs are prefilters and service should be confirmed by address.

### VT

- Repo before: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Green Mountain Transit, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Green Mountain Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridegmt.com
  note: Green Mountain Transit adds a Vermont transit provider beyond utility-only coverage.

### VA

- Repo before: Appalachian Power, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy Virginia, E-ZPass, Fairfax Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power, Arlington County Water-Sewer-Refuse Utility, Astound Broadband, AT&T Fiber, Central Virginia Electric Cooperative, CenturyLink (Lumen), City of Virginia Beach Public Utilities, Columbia Gas of Virginia, Cox Communications, Dominion Energy Virginia, E-ZPass, E-ZPass Virginia, Fairfax Water, Hampton Roads Transit, Loudoun Water, Northern Virginia Electric Cooperative, Old Dominion Power, Prince William Water, Rappahannock Electric Cooperative, Richmond Gas Works, Roanoke Gas Company, Shenandoah Valley Electric Cooperative, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Virginia Natural Gas, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- E-ZPass Virginia | TRANSPORTATION_TOLL | newly_added | state | https://www.ezpassva.com/
  note: Virginia E-ZPass is the statewide toll account issuer for Virginia toll facilities; account relevance depends on driving/toll use rather than residence utility territory.
- Old Dominion Power | UTILITY_ELECTRIC | newly_added | live_address | https://lge-ku.com/odp
  note: Old Dominion Power is the Virginia customer-facing KU electric surface; exact ZIPs are southwest Virginia prefilters and service should be confirmed by address.
- Northern Virginia Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.novec.com/Customer_Services/Apply-for-Service.cfm
  note: NOVEC serves selected Northern Virginia cooperative territories; exact ZIPs are prefilters and service should be confirmed by address.
- Rappahannock Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.myrec.coop/startstop-service
  note: REC serves portions of many Virginia counties; exact ZIPs are prefilters and service should be confirmed by address.
- Shenandoah Valley Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.svec.coop/member-services/start-stop-service/
  note: SVEC is a Shenandoah Valley cooperative electric provider; exact ZIPs are prefilters and service should be confirmed by address.
- Central Virginia Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.mycvec.com/member-services/start-stop-move-service/
  note: CVEC serves portions of central Virginia counties; exact ZIPs are prefilters and service should be confirmed by address.
- Virginia Natural Gas | UTILITY_GAS | newly_added | live_address | https://www.virginianaturalgas.com/residential/manage-your-account/start-stop-transfer-service.html
  note: Virginia Natural Gas serves selected southeastern Virginia addresses; exact ZIPs are prefilters and gas availability should be confirmed by address.
- Columbia Gas of Virginia | UTILITY_GAS | newly_added | live_address | https://www.columbiagasva.com/services/start-stop-or-move-service
  note: Columbia Gas of Virginia has non-contiguous gas territories; exact ZIPs are prefilters and service should be confirmed by address.
- Roanoke Gas Company | UTILITY_GAS | newly_added | live_address | https://www.roanokegas.com/become-a-customer/residential-service/
  note: Roanoke Gas is regional and address-qualified; exact ZIPs are Roanoke-area prefilters.
- Richmond Gas Works | UTILITY_GAS | newly_added | live_address | https://richmondgasworks.com/service/start-stop-transfer-service/
  note: Richmond Gas Works serves Richmond-area gas customers; exact ZIPs are metro prefilters and service should be confirmed by address.
- Loudoun Water | UTILITY_WATER | newly_added | live_address | https://www.loudounwater.org/content/start-service
  note: Loudoun Water serves designated water and sewer areas outside incorporated towns; exact ZIPs are prefilters and service should be confirmed by address.
- Prince William Water | UTILITY_WATER | newly_added | live_address | https://princewilliamwater.org/our-customers/how-to/start-service
  note: Prince William Water serves most of Prince William County, but exact utility eligibility should be confirmed by address.
- City of Virginia Beach Public Utilities | UTILITY_WATER | newly_added | live_address | https://pu.virginiabeach.gov/customer-service/online-services
  note: Virginia Beach Public Utilities provides water and sanitary sewer workflows for city service addresses; exact ZIPs are city prefilters.
- Arlington County Water-Sewer-Refuse Utility | UTILITY_WATER | newly_added | live_address | https://www.arlingtonva.us/Government/Programs/Water-Utilities/Customer-Service/Start-Stop-Service
  note: Arlington utility accounts cover water, sewer, and refuse for county service addresses; exact ZIPs are county prefilters.
- Hampton Roads Sanitation District | UTILITY_SEWER | newly_added | live_address | https://www.hrsd.com/customers
  note: HRSD is a regional wastewater utility; exact ZIPs are Hampton Roads/Eastern Shore prefilters and billing/service applicability should be confirmed by address.
- City of Virginia Beach Waste Management | UTILITY_TRASH | newly_added | live_address | https://pw.virginiabeach.gov/trash-recycling
  note: Virginia Beach trash and recycling service applies to eligible city residential addresses; exact ZIPs are city prefilters.
- Hampton Roads Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://gohrt.com/routes/
  note: HRT expands Virginia transit coverage beyond DC-region rail providers.

### WA

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, Good To Go!, NW Natural, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, Benton PUD, Cascade Natural Gas, CenturyLink (Lumen), Chelan County PUD, City of Spokane Utilities, Clark Public Utilities, Cowlitz County Public Utility District, E-ZPass, Frontier Communications, Good To Go!, Grant PUD, King County Metro, Lewis County PUD, Mason County PUD No. 3, NW Natural, Pacific Power Washington, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Snohomish County PUD, Spectrum, Starlink, T-Mobile Home Internet, Tacoma Public Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- King County Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://kingcounty.gov/en/dept/metro
  note: King County Metro adds the largest Washington transit network beyond Seattle-only utilities.
- Snohomish County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.snopud.com/account/my-account/start-stop-service/
  note: Snohomish County PUD provides electric service to all of Snohomish County and Camano Island plus selected water systems; modeled with exact local ZIPs and address confirmation.
- Tacoma Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mytpu.org/payment-billing/start-stop-service/
  note: Tacoma Public Utilities handles power and water account workflows for Tacoma-area movers; exact ZIPs are a prefilter and service address confirmation is required.
- Clark Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.clarkpublicutilities.com/start-stop-transfer-service/
  note: Clark Public Utilities provides electric service throughout Clark County and water service in selected areas; modeled with exact Clark County ZIPs and address confirmation.
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.
- Pacific Power Washington | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pacificpower.net/my-account/start-stop-move.html
  note: Pacific Power serves south-central and southeastern Washington communities around Yakima and Walla Walla; separate WA row avoids changing the existing Oregon-focused seed entry.
- City of Spokane Utilities | UTILITY_WATER | newly_added | zip_prefix | https://my.spokanecity.org/publicworks/utility-billing/
  note: City of Spokane utility billing covers water, wastewater, stormwater, and solid waste for city and adjacent service customers; exact ZIPs are a prefilter and address confirmation is required.
- Chelan County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.chelanpud.org/my-pud-services/start-stop-services
  note: Chelan County PUD provides electric service and selected water/wastewater systems in Chelan County; modeled with exact county ZIPs and address confirmation.
- Grant PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.grantpud.org/start-stop-service
  note: Grant PUD provides start, stop, and transfer workflows for Grant County electric customers; modeled with exact local ZIPs and address confirmation.
- Benton PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.bentonpud.org/manage-my-account/start-stop-service
  note: Benton PUD provides electric start, stop, and transfer workflows for Kennewick, Prosser, and surrounding Benton County areas; exact ZIPs are a prefilter.
- Cowlitz County Public Utility District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cowlitzpud.org/new-services/start-stop-or-transfer-service/
  note: Cowlitz PUD provides county electric start, stop, and transfer workflows; modeled with exact Cowlitz County ZIPs and address confirmation.
- Lewis County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.lcpud.org/services/start-stop-service/
  note: Lewis County PUD is a regional public electric utility; exact ZIPs are a conservative prefilter because Centralia City Light and other municipal overlaps exist.
- Mason County PUD No. 3 | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pud3.org/electric-service/electric-start-new-service/
  note: Mason PUD 3 serves most of Mason County and small adjacent areas; modeled with exact local ZIPs and address confirmation.

### WV

- Repo before: Appalachian Power, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountaineer Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountain Line Transit Authority, Mountaineer Gas, Potomac Edison, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Mountain Line Transit Authority | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://busride.org/routes/
  note: West Virginia transit addition centered on Morgantown.
- Potomac Edison | UTILITY_ELECTRIC | newly_added | live_address | https://www.firstenergycorp.com/potomac_edison.html
  note: Potomac Edison serves western Maryland and parts of West Virginia; ZIP prefixes are a prefilter and service address confirmation is required.

### WI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Alliant Energy, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Spectrum Maine, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Alliant Energy | UTILITY_ELECTRIC | newly_added | state | https://www.alliantenergy.com/who-we-are/communities-we-serve
  note: Alliant Energy is a major Iowa/Wisconsin utility called out in state rules but missing from seed.

### WY

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, E-ZPass, Enbridge Gas Utah, MDU Resources, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, Cheyenne Transit Program, E-ZPass, Enbridge Gas Utah, MDU Resources, Montana-Dakota Utilities, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
- Cheyenne Transit Program | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cheyennecity.org/Your-Government/Departments/Public-Works/Transit/Fixed-Route-Service
  note: Cheyenne Transit Program adds a Wyoming public transit surface beyond utilities.

