# State Provider Completeness Catalog

Generated: 2026-06-14T04:36:54.797Z

## Summary

- Catalog entries: 310
- States covered: 51
- Already present in raw seed: 3
- Newly added in merged seed: 301
- Catalog-only backlog entries: 6
- Coverage models: state=14, zip_prefix=197, polygon=5, live_address=94
- Official URL validation: ok=205, redirect=91, error=14

## Per-State Diff

### AL

- Repo before: Alabama Power, Alagasco, Astound Broadband, AT&T Fiber, Birmingham Water Works, CenturyLink (Lumen), E-ZPass, Frontier Communications, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alabama Freedom Pass, Alabama Power, Alagasco, Astound Broadband, AT&T Fiber, Birmingham Water Works, CenturyLink (Lumen), City of Tuscaloosa Water, Decatur Utilities Electric, E-ZPass, Frontier Communications, Huntsville Utilities, Madison County Water Department, MAX Transit, Mobile Area Water and Sewer System Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- MAX Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://maxtransit.org
  note: Birmingham-area transit provider missing from the seed; modeled with Birmingham metro ZIP prefixes.
  source: Home - MAX Transit
- Alabama Department of Revenue Motor Vehicle Division | GOVERNMENT_DMV | newly_added | state | https://www.revenue.alabama.gov/division/motor-vehicle/
  note: Official Alabama motor vehicle registration and tax surface; complements the existing driver-license DMV row.
  source: Motor Vehicle - Alabama Department of Revenue
- Alabama Freedom Pass | TRANSPORTATION_TOLL | newly_added | state | https://freedompass.americanroads.com
  note: Real toll pass account provider; state-scoped because the batch did not include reliable facility ZIPs.
  source: Alabama Freedom Pass Online
- Decatur Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.decaturutilities.com
  note: Real municipal electric utility; modeled with Decatur-area ZIP prefix and address confirmation language.
  source: Utility Services Decatur Alabama | Decatur Utilities | United States
- Huntsville Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hsvutil.org
  note: Real municipal utility; gas duplicate is folded into this single provider row.
  source: Huntsville Utilities
- Southeast Gas | UTILITY_GAS | catalog_backlog | live_address | https://southeastgas.com
  note: Real gas utility from Batch 1, but the candidate had unknown territory; catalog-only until ZIP/service-area confirmation.
  source: Home - Southeast Gas
- City of Huntsville Water Pollution Control | UTILITY_SEWER | newly_added | zip_prefix | https://www.huntsvilleal.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: City of Huntsville - Official website of the City of Huntsville, Alabama
- Jefferson County Environmental Services Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.jeffcoes.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Jefferson County Environmental Services &ndash; HOME
- City of Tuscaloosa Water | UTILITY_WATER | newly_added | zip_prefix | https://www.tuscaloosa.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: City of Tuscaloosa
- Madison County Water Department | UTILITY_WATER | newly_added | zip_prefix | https://www.madisoncountyal.gov/departments/water-department
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Access Denied
- Mobile Area Water and Sewer System Water | UTILITY_WATER | newly_added | zip_prefix | https://www.mawss.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: MAWSS

### AK

- Repo before: Anchorage Water & Wastewater Utility, Astound Broadband, AT&T Fiber, Chugach Electric, E-ZPass, ENSTAR Natural Gas, GCI, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alaska Electric Light and Power, Anchorage Water & Wastewater Utility, Anton Anderson Memorial Tunnel / Whittier Tunnel, Astound Broadband, AT&T Fiber, Chugach Electric, City and Borough of Juneau Water Utility, College & Golden Heart Utilities Water, E-ZPass, ENSTAR Natural Gas, GCI, Golden Valley Electric Association, Homer Electric Association, Interior Gas Utility, Ketchikan Public Utilities Electric, Matanuska Electric Association, People Mover, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- People Mover | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.muni.org/Departments/transit/PeopleMover/pages/mapsandstops.aspx
  note: Anchorage People Mover is the largest public transit provider in Alaska and was not in seed.
  source: People Mover Route Maps and Bus Stop Lists
- Alaska Communications | UTILITY_INTERNET | catalog_backlog | live_address | https://www.alaskacommunications.com/Residential
  note: Alaska Communications is a major Alaska ISP/voice provider. The official surface is address-qualified rather than ZIP-complete.
  source: Home Internet &amp; Voice Services Provider - Alaska Communications
- Anton Anderson Memorial Tunnel / Whittier Tunnel | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://dot.alaska.gov/creg/whittiertunnel/index.shtml
  note: Batch 1 toll facility addition; corridor-scoped and not a statewide Alaska toll recommendation.
  source: Whittier Tunnel, Transportation &amp; Public Facilities, State of Alaska
- Alaska Electric Light and Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.aelp.com
  note: Real electric utility; modeled with Juneau-area ZIP prefix and address confirmation language.
  source: Alaska Electric Light & Power | Juneau, Alaska
- Golden Valley Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.gvea.com
  note: Real electric utility; modeled with cautious AK 997 ZIP prefix and address confirmation language.
  source: Golden Valley Electric Assn
- Homer Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.homerelectric.com
  note: Real electric utility; modeled with cautious AK 996 ZIP prefix and address confirmation language.
  source: Homer Electric Association
- Ketchikan Public Utilities Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.ketchikan.gov/ketchikan-public-utilities
  note: Real municipal electric utility; modeled with Ketchikan-area ZIP prefix and address confirmation language.
  source: Official Website of the City of Ketchikan, Alaska - Ketchikan Public Utilities
- Matanuska Electric Association | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mea.coop
  note: Real electric cooperative; modeled with cautious AK 995/996 ZIP prefixes and address confirmation language.
  source: Matanuska Electric Association, Inc. – Community Built &amp; Led Since 1941
- Interior Gas Utility | UTILITY_GAS | newly_added | zip_prefix | https://www.interiorgas.com
  note: Real gas utility; modeled with cautious AK 997 ZIP prefix and address confirmation language.
  source: Interior Alaska Natural Gas Utility
- City and Borough of Juneau Water Utility | UTILITY_WATER | newly_added | zip_prefix | https://juneau.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: City and Borough of Juneau &#8211; Alaska&#039;s Capital City
- College & Golden Heart Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.mywater.us/alaska/about-us-menu
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: College &amp; Golden Heart Utilities | About Us

### AZ

- Repo before: Arizona Public Service, Arizona Water Company, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Mesa Utilities, City of Phoenix Water Services, Cox Communications, E-ZPass, EPCOR Water Arizona, Frontier Communications, Google Fiber, Liberty Utilities Arizona Water and Wastewater, Mohave Electric Cooperative, Salt River Project, Southwest Gas, Spectrum, Starlink, Sulphur Springs Valley Electric Cooperative, T-Mobile Home Internet, Trico Electric Cooperative, Tucson Water, UniSource Energy Services Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Arizona Public Service, Arizona Water Company, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Chandler Utility Services, City of Mesa Utilities, City of Phoenix Water Services, City of Scottsdale Utilities, City of Tempe Customer Services, Cox Communications, E-ZPass, EPCOR Water Arizona, Frontier Communications, Glendale Water Services, Google Fiber, Liberty Utilities Arizona Water and Wastewater, Mohave Electric Cooperative, Salt River Project, Southwest Gas, Spectrum, Starlink, Sulphur Springs Valley Electric Cooperative, T-Mobile Home Internet, Town of Gilbert Water, Trico Electric Cooperative, Tucson Electric Power, Tucson Water, UniSource Energy Services, UniSource Energy Services Gas, Valley Metro, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Valley Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.valleymetro.org/maps-schedules
  note: Phoenix-area Valley Metro was absent from seed and is modeled with core metro ZIP prefixes.
- Tucson Electric Power | UTILITY_ELECTRIC | newly_added | live_address | https://www.tep.com/im-moving/
  note: Primary Tucson-area electric utility; Tucson ZIP prefixes are only prefilters and start/stop/transfer service should be confirmed by address.
  source: I’m moving – Tucson Electric Power
- UniSource Energy Services Electric | UTILITY_ELECTRIC | newly_added | live_address | https://www.uesaz.com/im-moving/
  note: UniSource electric service is territory-specific in selected Arizona communities; gas is modeled separately for relocation workflows.
  source: I’m Moving – UniSource Energy Services
- Pima County Regional Wastewater Reclamation Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.pima.gov/wastewater
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Wastewater Reclamation | Pima County, AZ
- City of Chandler Utility Services | UTILITY_WATER | newly_added | live_address | https://www.chandleraz.gov/residents/utility-services
  note: Chandler utility services cover water, sewer, and solid waste account workflows; service should be confirmed by address.
  source: Chandler Utility Services | City of Chandler, AZ
- City of Tempe Customer Services | UTILITY_WATER | newly_added | live_address | https://www.tempe.gov/i-want-to/start-stop-water-service
  note: Tempe customer services cover water, sewer, and solid waste start, transfer, and stop workflows; service should be confirmed by address.
  source: Access Denied
- Glendale Water Services | UTILITY_WATER | newly_added | zip_prefix | https://www.glendaleaz.com/live/city_services/water_services
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Page Not Found | City of Glendale, AZ
- City of Scottsdale Utilities | UTILITY_WATER | newly_added | live_address | https://www.scottsdaleaz.gov/utilities/establish-service
  note: Scottsdale utilities require address confirmation before establishing water or related municipal utility service.
  source: Utility Service - Establish Service
- Town of Gilbert Water | UTILITY_WATER | newly_added | zip_prefix | https://www.gilbertaz.gov/departments/public-works/water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Access Denied

### AR

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Arkansas, Carroll Electric Cooperative Corporation, Central Arkansas Water, CenturyLink (Lumen), Cox Communications, E-ZPass, First Electric Cooperative Corporation, Oklahoma Gas & Electric (OG&E) - Arkansas Service Area, Spectrum, Starlink, Summit Utilities Arkansas, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Arkansas Oklahoma Gas Corporation (AOG), Astound Broadband, AT&T Fiber, Black Hills Energy Arkansas, Carroll Electric Cooperative Corporation, Central Arkansas Water, CenturyLink (Lumen), City of Bentonville Utilities, City of Fayetteville Utilities, City of Fort Smith Utilities, Conway Corporation, Cox Communications, E-ZPass, Entergy Arkansas, First Electric Cooperative Corporation, Jonesboro City Water and Light Water, North Little Rock Electric, Oklahoma Gas & Electric (OG&E) - Arkansas Service Area, Rogers Water Utilities, Southwestern Electric Power Company (SWEPCO), Spectrum, Springdale Water Utilities, Starlink, Summit Utilities Arkansas, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Entergy Arkansas | UTILITY_ELECTRIC | newly_added | live_address | https://www.entergyarkansas.com/
  note: Major Arkansas electric utility with broad county-level coverage; ZIPs are broad prefilters and service should be confirmed by address.
  source: Entergy Arkansas - We power life.
- Conway Corporation | UTILITY_ELECTRIC | newly_added | zip_prefix | https://conwaycorp.com/sign-up-for-a-service/
  note: Municipal multi-utility serving Conway electric, water, wastewater, and account workflows; modeled with Conway-area ZIP prefix and address confirmation language.
  source: Sign Up For A Service - Conway Corp
- North Little Rock Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://nlrelectric.com/forms/
  note: Real municipal electric utility; modeled with North Little Rock ZIP prefix and address confirmation language.
  source: Forms - North Little Rock Electric
- Southwestern Electric Power Company (SWEPCO) | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.swepco.com/account/service/start-stop-transfer
  note: Real electric utility; modeled with cautious Arkansas ZIP prefixes and address confirmation language.
  source: Start, Stop or Transfer Your Service
- Arkansas Oklahoma Gas Corporation (AOG) | UTILITY_GAS | newly_added | zip_prefix | https://www.aogc.com/RequestService
  note: Real gas utility; modeled with cautious western Arkansas ZIP prefix and address confirmation language.
  source: Request Service - Arkansas Oklahoma Gas
- Little Rock Water Reclamation Authority | UTILITY_SEWER | newly_added | zip_prefix | https://lrwra.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: LRWRA
- Springdale Water Utilities | UTILITY_WATER | newly_added | zip_prefix | https://springdalewaterar.gov/new-customer/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: New Customer - Springdale Water Utilities
- City of Bentonville Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.bentonvillear.com/565/Utility-Service
  note: Bentonville municipal utility surface covers electric, water, wastewater, irrigation, and solid waste; service must be confirmed by address.
  source: no-title | error: The operation was aborted due to timeout
- City of Fayetteville Utilities | UTILITY_WATER | newly_added | zip_prefix | https://www.fayetteville-ar.gov/1368/New-Water-and-Sewer-Services
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: New Water and Sewer Services | Fayetteville, AR - Official Website
- City of Fort Smith Utilities | UTILITY_WATER | newly_added | zip_prefix | https://www.fortsmithar.gov/resident-services/water-utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Access Denied
- Jonesboro City Water and Light Water | UTILITY_WATER | newly_added | zip_prefix | https://www.jonesborocwl.org
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Just a moment...
- Rogers Water Utilities | UTILITY_WATER | newly_added | zip_prefix | https://www.rogerswaterar.gov/residential/services-and-information/start-or-stop-service/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Start or Stop Service

### CA

- Repo before: AC Transit, Astound Broadband, AT&T Fiber, BART, Bay Area FasTrak, Caltrain, Cox Communications, E-ZPass, Frontier Communications, LA Metro, LADWP, PG&E, San Diego MTS, SF Muni, SoCalGas, Southern California Edison, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
- Repo after: 91 Express Lanes, AC Transit, Astound Broadband, AT&T Fiber, BART, Bay Area FasTrak, Caltrain, City of Fresno Utilities Water, City of Sacramento Department of Utilities Water, City of San Diego Water/Wastewater, Cox Communications, E-ZPass, East Bay Municipal Utility District Water, Frontier Communications, Golden State Water, LA Metro, LADWP, Long Beach Utilities Water, Metro ExpressLanes, PG&E, Riverside Express, Sacramento Municipal Utility District, San Diego Gas & Electric, San Diego MTS, San Jose Water, SANDAG FasTrak, SF Muni, SoCalGas, Southern California Edison, Spectrum, Starlink, T-Mobile Home Internet, The Toll Roads, Verizon 5G Home Internet, Verizon Fios, VTA, WOW! Internet, Xfinity (Comcast)
- San Diego Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.sdge.com/landservices
  note: SDG&E serves San Diego County and parts of southern Orange County; modeled conservatively with southern California ZIP prefixes.
  source: New land services | San Diego Gas &amp; Electric
- 91 Express Lanes | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.91expresslanes.com
  note: Real toll account provider; modeled only around the corridor ZIP prefixes from Batch 1.
  source: 91 Express Lanes - Home
- Metro ExpressLanes | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.metroexpresslanes.net
  note: Real toll account provider; modeled only around Los Angeles corridor ZIP prefixes from Batch 1.
  source: Metro ExpressLanes &#8211; Metro ExpressLanes
- The Toll Roads | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.thetollroads.com
  note: Real toll account provider; modeled only around Orange County corridor ZIP prefixes from Batch 1.
  source: Home | The Toll Roads
- Sacramento Municipal Utility District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.smud.org
  note: Real electric utility; modeled with cautious Sacramento-area ZIP prefixes and address confirmation language.
  source: Home
- City of Fresno Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fresno.gov/publicutilities/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Public Utilities &#8211; City of Fresno
- City of Sacramento Department of Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.cityofsacramento.gov/utilities
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Utilities | City of Sacramento
- City of San Diego Water/Wastewater | UTILITY_WATER | newly_added | zip_prefix | https://www.sandiego.gov/public-utilities/customer-support
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Water/Wastewater Customer Support | City of San Diego Official Website
- East Bay Municipal Utility District Water | UTILITY_WATER | newly_added | zip_prefix | https://www.ebmud.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Home :: East Bay Municipal Utility District
- Long Beach Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.longbeach.gov/utilityservices/
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: MyUtility Portal
- San Jose Water | UTILITY_WATER | newly_added | zip_prefix | https://www.sjwater.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Home | San Jose Water
- Recology San Francisco | UTILITY_TRASH | newly_added | zip_prefix | https://www.recology.com/recology-san-francisco/
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Recology San Francisco
- Golden State Water | UTILITY_WATER | newly_added | zip_prefix | https://www.gswater.com/your-service-area
  note: Golden State Water serves many non-contiguous California communities across multiple regions; ZIP prefixes are intentionally broad prefilters and service address confirmation is required.
  source: Your Service Area - Golden State Water Company
- Riverside Express | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.riversideexpress.com
  note: Secondary Southern California toll account surface for Riverside County 15 Express Lanes; corridor ZIP prefix is a prefilter.
  source: Riverside Express, Express Lanes, FasTrak
- SANDAG FasTrak | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.myfastrak.511sd.com
  note: Secondary San Diego FasTrak account surface for SANDAG-operated I-15 Express Lanes and SR 125 Toll Road; ZIP prefixes are San Diego-region prefilters.
  source: SANDAG FasTrak

### CO

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Colorado, CenturyLink (Lumen), Denver Water, E-ZPass, ExpressToll, Google Fiber, RTD, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy Colorado, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Colorado, Aurora Water, Black Hills Energy Colorado, CenturyLink (Lumen), City of Boulder Utilities, City of Longmont Utilities, City of Loveland Utilities, City of Westminster Utilities, Colorado Springs Utilities, CORE Electric Cooperative, Denver Water, E-ZPass, ExpressToll, Fort Collins Utilities, Google Fiber, Holy Cross Energy, Poudre Valley REA, RTD, RTD Denver, Spectrum, Starlink, T-Mobile Home Internet, United Power, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy Colorado, Xfinity (Comcast)
- RTD Denver | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.rtd-denver.com/system-map
  note: Regional Transportation District is the core transit provider for Denver metro.
  source: System Map | RTD-Denver
- E-470 Public Highway Authority | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.e470.com
  note: Toll facility authority folded into the existing ExpressToll account provider to avoid duplicate resident-facing toll account rows.
  source: E470 Public Highway Authority - Express Toll Colorado
- Northwest Parkway | TRANSPORTATION_TOLL | catalog_backlog | polygon | https://www.nwpky.com
  note: Toll road facility folded into ExpressToll for the resident-facing account and payment surface.
  source: Home - Northwest Parkway
- Aurora Water | UTILITY_WATER | newly_added | live_address | https://www.auroragov.org/residents/water/pay_my_water_bill/home_sellers_buyers_checklist/general_escrow_request_and_transfer_of_ownership
  note: Aurora Water is city-scoped but address-specific, with ownership-transfer and billing workflows for eligible water accounts.
  source: General escrow request and transfer of ownership - City of Aurora
- City of Boulder Utilities | UTILITY_WATER | newly_added | live_address | https://bouldercolorado.gov/water-service-request-form
  note: Boulder water, wastewater, and stormwater billing is city-scoped but exact service should be confirmed by address.
  source: Water Service Request Form | City of Boulder
- Colorado Springs Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.csu.org/my-account/start-stop-service
  note: Colorado Springs Utilities is a municipal multi-utility for electric, gas, water, and wastewater; ZIPs are city-area prefilters and service should be confirmed by address.
  source: Start, stop or move service
- Fort Collins Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://secure.fcgov.com/utilities-service-request/
  note: Fort Collins Utilities provides electric, water, wastewater, and stormwater service; exact eligibility should be confirmed by service address.
  source: City of Fort Collins Utilities Start/Stop Service Request
- Atmos Energy Colorado | UTILITY_GAS | already_present | live_address | https://www.atmosenergy.com/accountcenter/moveininf/bpMoveInStart.html
  note: Atmos Energy Colorado serves selected communities across northeastern, San Luis Valley, and southwest Colorado; ZIPs are prefilters and service must be confirmed by address.
  source: Atmos Energy Account Center
- City and County of Denver Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Recycle-Compost-Trash
  note: Denver Solid Waste Management applies to eligible City and County of Denver residential service addresses, not the full metro.
  source: Trash, Recycle & Compost - City and County of Denver
- City of Westminster Utilities | UTILITY_WATER | newly_added | live_address | https://www.westminsterco.gov/184/Utility-Billing
  note: Westminster water, wastewater, stormwater, and utility billing are city-scoped; ZIPs are prefilters and service should be confirmed by address.
  source: Utility Billing | Westminster, CO
- CORE Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://core.coop/start-stop-service/
  note: CORE Electric Cooperative serves selected Front Range and foothills communities; exact membership/service should be confirmed by address.
  source: Start/Stop Service - CORE
- United Power | UTILITY_ELECTRIC | newly_added | live_address | https://www.unitedpower.com/start-transfer-stop
  note: United Power serves northern Front Range cooperative members; ZIPs are prefilters and service should be confirmed by address.
  source: Start, Transfer or Stop Service | United Power
- Poudre Valley REA | UTILITY_ELECTRIC | newly_added | live_address | https://pvrea.coop/for-members/account-management/start-stop-service/
  note: Poudre Valley REA serves parts of Larimer, Weld, and Boulder counties; exact service should be confirmed by address.
  source: Start &amp; Stop Service | Poudre Valley REA
- Holy Cross Energy | UTILITY_ELECTRIC | newly_added | live_address | https://www.holycross.com/account-services/services/service-requests/start-stop-transfer-service
  note: Holy Cross Energy serves selected western Colorado mountain communities; ZIPs are prefilters and service should be confirmed by address.
  source: Start, Stop, Transfer Service - Holy Cross Energy
- City of Longmont Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://longmontcolorado.gov/utilities-and-public-works/utility-bill/start-or-stop-service/
  note: Longmont municipal utility billing covers city electric, water, sewer, and waste-management workflows; service should be confirmed by address.
  source: Start or Stop Service - City of Longmont
- City of Loveland Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.lovelandwaterandpower.org/about-us/start-stop-or-move-service
  note: Loveland Water and Power is a municipal utility for Loveland service addresses; ZIPs are city prefilters and service should be confirmed by address.
  source: Access Denied
- Colorado Natural Gas | UTILITY_GAS | catalog_backlog | live_address | https://www.coloradonaturalgas.com/service-areas
  note: Catalog-only backlog: official service-area workflow is address/map based, but the current candidate does not provide a reliable ZIP prefilter for resident-facing recommendations.
  source: ServiceAreas - Colorado Natural Gas

### CT

- Repo before: Aquarion Water Company of Connecticut, Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Eversource Energy, Frontier Communications, Optimum, Southern Connecticut Gas Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of Connecticut, Astound Broadband, AT&T Fiber, Connecticut Natural Gas, Connecticut Water Company, Cox Communications, E-ZPass, Eversource Energy, Frontier Communications, Groton Utilities, Jewett City Department of Public Utilities, Metropolitan District Commission, Norwich Public Utilities, Optimum, South Central Connecticut Regional Water Authority, Southern Connecticut Gas Company, Spectrum, Starlink, T-Mobile Home Internet, United Illuminating, Verizon 5G Home Internet, Verizon Fios, Wallingford Electric Division, WOW! Internet, Xfinity (Comcast)
- United Illuminating | UTILITY_ELECTRIC | newly_added | live_address | https://www.uinet.com/moving
  note: United Illuminating covers 17 towns in greater New Haven and Bridgeport; exact ZIPs are prefilters and service should be confirmed by address.
  source: no-title | error: The operation was aborted due to timeout
- Connecticut Natural Gas | UTILITY_GAS | newly_added | live_address | https://www.cngcorp.com/moving
  note: Connecticut Natural Gas serves central Connecticut and Greenwich gas customers; exact ZIPs are prefilters and service should be confirmed by address.
  source: no-title | error: The operation was aborted due to timeout
- Connecticut Water Company | UTILITY_WATER | newly_added | live_address | https://www.ctwater.com/service-billing/your-service/developer-projects-and-new-service-connections/
  note: Connecticut Water serves many non-contiguous towns; exact ZIPs are prefilters and water service should be confirmed by address.
  source: Start New Service | Connecticut Water
- Access Health CT | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.accesshealthct.com
  note: Official Connecticut health marketplace account surface, modeled with Connecticut ZIP prefixes.
  source: no-title | error: fetch failed
- HUSKY Health | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://portal.ct.gov/HUSKY
  note: Official Connecticut Medicaid/HUSKY health account surface, modeled with Connecticut ZIP prefixes.
  source: Connecticut Husky Health
- Connecticut Department of Revenue Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://portal.ct.gov/DRS
  note: Official Connecticut tax account/address surface, modeled with Connecticut ZIP prefixes.
  source: Connecticut Department of Revenue Services
- Jewett City Department of Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.jewettcitydpu.com
  note: Real municipal electric utility; modeled with CT 063 ZIP prefix and address confirmation language.
  source: Jewett City DPU, CT | Official Website
- Norwich Public Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://norwichpublicutilities.com
  note: Real Norwich municipal multi-utility; exact ZIPs are city prefilters and electric, gas, water, and sewer activation should be confirmed by address.
  source: Norwich Public Utilities, CT | Official Website
- Wallingford Electric Division | UTILITY_ELECTRIC | newly_added | live_address | https://www.wallingfordct.gov/government/departments/electric-division/
  note: Real municipal electric utility for Wallingford and part of Northford; exact ZIPs are prefilters and service should be confirmed by address.
  source: Electric Division | Town of Wallingford
- Groton Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://grotonutilities.com/221/Start-or-Stop-Service
  note: Groton Utilities is a municipal electric and water provider; exact ZIPs are prefilters and service should be confirmed by address.
  source: no-title | error: The operation was aborted due to timeout
- Bridgeport Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.bridgeportct.gov/government/departments/water-pollution-control-authority-wpca
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Water Pollution Control Authority (WPCA) | City of Bridgeport
- Greater New Haven Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://gnhwpca.com
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Home
- Stamford Water Pollution Control Authority | UTILITY_SEWER | newly_added | zip_prefix | https://www.stamfordct.gov/government/operations/water-pollution-control-authority
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Access Denied
- Metropolitan District Commission | UTILITY_WATER | newly_added | live_address | https://themdc.org/
  note: Hartford-area regional water and sewer authority; ZIP prefixes are prefilters and service should be confirmed by property address.
  source: The Metropolitan District | CT Water Utility Services
- South Central Connecticut Regional Water Authority | UTILITY_WATER | newly_added | live_address | https://www.rwater.com/customer-care/start-or-stop-service
  note: South Central Connecticut RWA serves listed New Haven-area communities; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start Stop

### DE

- Repo before: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities, Delmarva Power, E-ZPass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Artesian Water Company, Astound Broadband, AT&T Fiber, Chesapeake Utilities, City of Dover Electric Department, City of Milford Electric, City of Newark Electric, DART First State, Delaware E-ZPass, Delaware Electric Cooperative, Delmarva Power, E-ZPass, Lewes Board of Public Works Electric, Municipal Services Commission of the City of New Castle Electric, Spectrum, Starlink, T-Mobile Home Internet, Town of Middletown Electric, Town of Smyrna Electric, Verizon 5G Home Internet, Verizon Fios, Wilmington Water Utility, WOW! Internet, Xfinity (Comcast)
- DART First State | TRANSPORTATION_TRANSIT | newly_added | state | https://dartfirststate.com/map/
  note: DART First State operates statewide bus and paratransit service in Delaware.
  source: DART Interactive Map - Dart First State
- Delaware Medicaid / ASSIST | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://assist.dhss.delaware.gov
  note: Official Delaware benefits and Medicaid account surface, modeled with Delaware ZIP prefixes.
  source: ASSIST Home
- Delaware Taxpayer Portal | GOVERNMENT_TAX | newly_added | zip_prefix | https://tax.delaware.gov
  note: Official Delaware taxpayer account surface, modeled with Delaware ZIP prefixes.
  source: Home
- Delaware E-ZPass | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ezpassde.com
  note: Real Delaware toll account provider; US 301 toll-by-plate row is folded into this account surface.
  source: Delaware E-ZPass
- City of Dover Electric Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cityofdover.gov/Public-Utilities/
  note: Real municipal electric utility; modeled with exact Dover ZIPs from Batch 1 and address confirmation language.
  source: City of Dover Delaware - Electric Department
- City of Milford Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cityofmilford.com
  note: Real municipal electric utility; modeled with exact Milford ZIP from Batch 1 and address confirmation language.
  source: Milford, DE - Official Website | Official Website
- City of Newark Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://newarkde.gov/18/Electrical-Engineering
  note: Real municipal electric utility; modeled with exact Newark ZIPs from Batch 1 and address confirmation language.
  source: Electrical Engineering | Newark, DE - Official Website
- Delaware Electric Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.delaware.coop
  note: Real electric cooperative; modeled with cautious DE 199 ZIP prefix and address confirmation language.
  source: Delaware Electric Cooperative | We keep the lights on
- Lewes Board of Public Works Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.lewesbpwde.gov
  note: Real municipal electric utility; modeled with exact Lewes ZIP from Batch 1 and address confirmation language.
  source: Home - Lewes BPW
- Municipal Services Commission of the City of New Castle Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://newcastlemsc.delaware.gov
  note: Real municipal electric utility; modeled with exact New Castle ZIP from Batch 1 and address confirmation language.
  source: Home - Municipal Services Commission - MSC
- Town of Middletown Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.middletown.delaware.gov
  note: Real municipal electric utility; modeled with exact Middletown ZIPs from Batch 1 and address confirmation language.
  source: Official Website for the Town of Middletown Delaware
- Town of Smyrna Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://smyrna.delaware.gov
  note: Real municipal electric utility; modeled with exact Smyrna ZIP from Batch 1 and address confirmation language.
  source: no-title | error: The operation was aborted due to timeout
- Kent County Wastewater Division | UTILITY_SEWER | newly_added | zip_prefix | https://www.kentcountyde.gov/My-Government/Departments/Public-Works
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Department of Public Works Kent County Levy Court
- New Castle County Sewer | UTILITY_SEWER | newly_added | zip_prefix | https://www.newcastlede.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: New Castle County, DE - Official Website | Official Website
- Sussex County Environmental Services | UTILITY_SEWER | newly_added | zip_prefix | https://sussexcountyde.gov/sewer-water
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Sewer &amp; Water | Sussex County
- Wilmington Water Utility | UTILITY_WATER | newly_added | zip_prefix | https://www.wilmingtondewater.gov
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Wilmington Water Utility | Official Website

### DC

- Repo before: Astound Broadband, AT&T Fiber, DC Water, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, DC Streetcar, DC Water, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- DC Streetcar | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://dcstreetcar.com
  note: DC Streetcar adds a district-specific transit option beyond WMATA.
  source: DC Streetcar End of Service: Information and Updates | ddot
- DC Health Link | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.dchealthlink.com
  note: Official DC health marketplace account surface, modeled with District ZIP prefixes.
  source: Just a moment...
- District Direct | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://districtdirect.dc.gov
  note: Official DC benefits account portal, modeled with District ZIP prefixes.
  source: District Direct
- MyTax.DC.gov | GOVERNMENT_TAX | newly_added | zip_prefix | https://mytax.dc.gov
  note: Official DC tax account portal, modeled with District ZIP prefixes.
  source: MyTax DC

### FL

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Tampa Utilities, Cox Communications, Duke Energy Florida, E-ZPass, Florida Power & Light Company, Frontier Communications, JEA, Lynx, Miami-Dade Transit, Miami-Dade Water and Sewer Department, Orlando Utilities Commission, Peoples Gas Florida, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Tampa Utilities, Cox Communications, Duke Energy Florida, E-PASS / Central Florida Expressway Authority, E-ZPass, Florida City Gas, Florida Power & Light Company, Florida Public Utilities, Frontier Communications, Gainesville Regional Utilities, Greater Miami Expressway Agency, Hillsborough County Water Resources, I-4 Express, JEA, Kissimmee Utility Authority, Lakeland Electric, LeeWay, Lynx, Miami-Dade Transit, Miami-Dade Water and Sewer Department, Orange County Utilities Water, Orlando Utilities Commission, Palm Beach County Water Utilities Department, Peoples Gas Florida, Pinellas County Utilities, Spectrum, Starlink, SunPass, T-Mobile Home Internet, Tampa Electric, Tampa Hillsborough Expressway Authority, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Tampa Electric | UTILITY_ELECTRIC | newly_added | live_address | https://www.tampaelectric.com/residential/start-service/
  note: Tampa Electric serves Hillsborough and parts of Pasco, Pinellas, and Polk counties; ZIP prefixes are Tampa Bay prefilters and service should be confirmed by address.
  source: Start Service
- Florida KidCare | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://www.floridakidcare.org
  note: Official Florida child health insurance account surface, modeled with Florida ZIP prefixes from Batch 1.
  source: Florida KidCare | High-quality health and dental insurance made just for kids
- Florida Medicaid / MyACCESS | GOVERNMENT_HEALTH | newly_added | zip_prefix | https://myaccess.myflfamilies.com
  note: Official Florida benefits/Medicaid account surface, modeled with Florida ZIP prefixes from Batch 1.
  source: MyACCESS
- Florida DOR e-Services | GOVERNMENT_TAX | newly_added | zip_prefix | https://floridarevenue.com
  note: Official Florida tax e-services account surface, modeled with Florida ZIP prefixes from Batch 1.
  source: Florida Dept. of Revenue - Florida Dept. of Revenue
- E-PASS / Central Florida Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://epass.cfxway.com/
  note: Real Central Florida toll account provider; modeled around Orlando/Central Florida corridor ZIP prefixes and distinct from SunPass.
  source: no-title | error: fetch failed
- Greater Miami Expressway Agency | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.gmx-way.com
  note: Real Miami-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
  source: Greater Miami Expressway Agency
- I-4 Express | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://i4express.com
  note: Real I-4 Express toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
  source: I-4 Express - I4Express.com
- Tampa Hillsborough Expressway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.tampa-xway.com
  note: Real Tampa-area toll account/payment provider; modeled around Batch 1 corridor ZIP prefixes.
  source: Home - Tampa Hillsborough Expressway Authority
- Florida City Gas | UTILITY_GAS | newly_added | live_address | https://www.floridacitygas.com/residential/start-stop-transfer-or-add/
  note: Florida City Gas serves South Florida and Treasure Coast pockets; ZIP prefixes are prefilters and gas service should be confirmed by address.
  source: Start, Stop, Transfer or Add - Florida City Gas
- Hillsborough County Water Resources | UTILITY_WATER | newly_added | zip_prefix | https://hcfl.gov/residents/property-owners-and-renters/water-and-sewer/request-to-start-stop-or-move-water-service
  note: Batch 2A water/sewer utility customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Request to Start, Stop, or Move Water Service | Hillsborough County, FL
- Miami-Dade Solid Waste Management | UTILITY_TRASH | newly_added | zip_prefix | https://www.miamidade.gov/solidwaste
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Department of Solid Waste Management
- Orange County Utilities Water | UTILITY_WATER | newly_added | zip_prefix | https://www.orangecountyfl.net/WaterGarbageRecycling.aspx
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Water, Garbage & Recycling
- Palm Beach County Water Utilities Department | UTILITY_WATER | newly_added | zip_prefix | https://discover.pbcgov.org/waterutilities
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Water Utilities Home
- Pinellas County Utilities | UTILITY_WATER | newly_added | zip_prefix | https://pinellas.gov/services/request-utilities-service/
  note: Batch 3A customer account provider; ZIP-prefix scoped and address confirmation required before acting.
  source: Request Utilities Service - Pinellas County
- Florida Public Utilities | UTILITY_GAS | newly_added | live_address | https://fpuc.com/customer-care/start-stop-transfer-service/
  note: Florida Public Utilities provides natural gas across parts of 25 Florida counties and electric service in selected Northeast/Northwest Florida areas; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Start / Stop / Transfer Service - Florida Public Utilities
- Lakeland Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://lakelandelectric.com/billing-and-payment/moving
  note: Lakeland Electric is a municipal electric utility for Lakeland-area customers; ZIP prefix is a prefilter and service address confirmation is required.
  source: Lakeland Electric - Start, Stop, Move Service
- Kissimmee Utility Authority | UTILITY_ELECTRIC | newly_added | zip_prefix | https://kua.com/contact-information/contact-kua/
  note: KUA serves Kissimmee and surrounding Osceola County electric customers; ZIP prefix is a prefilter and service address confirmation is required.
  source: Contact KUA - Kissimmee Utility Authority
- Gainesville Regional Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.gru.com
  note: GRU is Gainesville's multi-service municipal utility for electric, natural gas, water, wastewater, and telecom; ZIP prefix is a prefilter and service address confirmation is required.
  source: GRU Home
- LeeWay | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.leegov.com/tolls
  note: LeeWay is Lee County's toll account/transponder service for local bridge toll facilities; exact ZIPs focus on Lee County and Bonita Springs service-area prefilters.
  source: Lee County Tolls - LeeWay

### GA

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Atlanta Department of Watershed Management, Cox Communications, E-ZPass, Georgia Natural Gas, Georgia Power, Google Fiber, MARTA, Peach Pass, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atlanta Gas Light, CenturyLink (Lumen), City of Atlanta Department of Watershed Management, Cobb County Water System, Cobb EMC, Cox Communications, DeKalb County Department of Watershed Management, E-ZPass, Fulton County Water Services, Gas South, Georgia Natural Gas, Georgia Power, Google Fiber, Gwinnett County Department of Water Resources, Marietta Power and Water, MARTA, Peach Pass, Sawnee EMC, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Georgia Department of Revenue Motor Vehicle Division | GOVERNMENT_DMV | newly_added | state | https://dor.georgia.gov/change-address-registration
  note: Georgia DOR Motor Vehicle Division handles vehicle registration, title, DRIVES e-Services, and vehicle registration address changes; it complements DDS driver license records.
  source: Change Address on Registration | Department of Revenue
- Atlanta Gas Light | UTILITY_GAS | newly_added | live_address | https://www.atlantagaslight.com/residential/start-stop-service.html
  note: Atlanta Gas Light is Georgia's gas delivery utility for many service areas; retail enrollment happens through certified marketers and availability should be confirmed by service address.
  source: Start/Stop Service
- Gas South | UTILITY_GAS | newly_added | live_address | https://www.gassouth.com/move-transfer-service
  note: Gas South is a Georgia retail natural gas marketer; ZIPs are gas-market prefilters and service should be confirmed by address and Atlanta Gas Light meter availability.
  source: Moving? Start New Gas Service, Turn Off or Transfer Service
- Cobb EMC | UTILITY_ELECTRIC | newly_added | live_address | https://www.cobbemc.com/start-stop-or-transfer-service
  note: Cobb EMC is a northwest metro Atlanta electric cooperative; exact ZIPs are prefilters and service must be confirmed with the address finder.
  source: Start, Stop or Transfer Service | Cobb EMC
- Sawnee EMC | UTILITY_ELECTRIC | newly_added | live_address | https://sawnee.coop/start-or-stop-service
  note: Sawnee EMC serves parts of northern Georgia counties; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start or Stop Service | Sawnee EMC
- Marietta Power and Water | UTILITY_ELECTRIC | newly_added | live_address | https://www.mariettaga.gov/431/Start-or-Stop-Your-Service
  note: Marietta Power and Water is a municipal electric and water utility; exact ZIPs are Marietta-area prefilters and service should be confirmed by address.
  source: no-title | error: The operation was aborted due to timeout
- Fulton County Water Services | UTILITY_WATER | newly_added | live_address | https://www.fultoncountyga.gov/services/water-services/start-your-water-service
  note: Fulton County Water Services covers county water/sewer service areas outside City of Atlanta; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start Your Water Service
- DeKalb County Department of Watershed Management | UTILITY_WATER | newly_added | live_address | https://dekalbcountyga.gov/departments/watershed-management
  note: DeKalb County Watershed handles water and sewer account workflows; exact ZIPs are county prefilters and service should be confirmed by address.
  source: Watershed Management | DeKalb County, GA
- Gwinnett County Department of Water Resources | UTILITY_WATER | newly_added | live_address | https://www.gwinnettcounty.com/government/departments/water
  note: Gwinnett County Water Resources supports start, stop, transfer, billing, and customer care workflows; exact ZIPs are prefilters.
  source: Water Resources - Gwinnett County - Gwinnett
- Cobb County Water System | UTILITY_WATER | newly_added | live_address | https://www.cobbcounty.gov/water/customers/setup-service
  note: Cobb County Water System is distinct from Marietta Power and Water; exact ZIPs are county prefilters and service should be confirmed by address.
  source: Setup Service | Cobb County Georgia | Cobb County Georgia
- DeKalb County Sanitation Division | UTILITY_TRASH | newly_added | live_address | https://dekalbcountyga.gov/departments/public-works/sanitation/new-residential-service
  note: DeKalb County Sanitation handles trash, recycling, and yard trimmings separately from DeKalb Watershed water/sewer service.
  source: Residential Service | DeKalb County, GA
- Gwinnett County Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://www.gwinnettcounty.com/services/solid-waste-management/start-service
  note: Gwinnett County manages the residential trash and recycling service framework; exact ZIPs are county prefilters and enrollment is address-based.
  source: Start New Trash Service - Gwinnett County - Gwinnett
- City of Atlanta Office of Solid Waste Services | UTILITY_TRASH | newly_added | live_address | https://www.atlantaga.gov/government/departments/public-works/office-of-solid-waste-services
  note: Atlanta Solid Waste Services handles garbage, recycling, and yard waste separately from Atlanta Watershed water/sewer accounts.
  source: Access Denied

### HI

- Repo before: Astound Broadband, AT&T Fiber, Board of Water Supply, City and County of Honolulu, E-ZPass, Hawaii Gas, Hawaiian Electric Company, Hawaiian Telcom, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Board of Water Supply, City and County of Honolulu, Department of Water Supply, County of Hawaii, Department of Water Supply, County of Maui, Department of Water, County of Kauai, E-ZPass, Hawaii Electric Light Company, Hawaii Gas, Hawaiian Electric Company, Hawaiian Telcom, Kauai Island Utility Cooperative, Maui Electric Company, Skyline, Spectrum, Starlink, T-Mobile Home Internet, TheBus, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Skyline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.honolulu.gov/skyline
  note: Honolulu Skyline adds a rail-specific transit surface beyond TheBus.
  source: Skyline Homepage
- City and County of Honolulu Division of Motor Vehicles, Licensing and Permits | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.honolulu.gov/csd/vehicle/
  note: Hawaii DMV services are county-run; this Oahu surface is exact-ZIP scoped to Honolulu County rather than statewide.
  source: Division of Motor Vehicles | Department of Customer Services
- Maui County Division of Motor Vehicles & Licensing | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.mauicounty.gov/1328/DMV
  note: Maui County runs its own driver licensing and motor vehicle workflows; modeled with exact Maui County ZIPs.
  source: no-title | error: The operation was aborted due to timeout
- County of Hawaii Vehicle Registration & Licensing Division | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.vrl.hawaiicounty.gov/motor-vehicle-registration
  note: County of Hawaii operates a separate Big Island vehicle registration and licensing surface; modeled with exact Hawaii County ZIPs.
  source: Access Denied
- County of Kauai Division of Motor Vehicles | GOVERNMENT_DMV | newly_added | zip_prefix | https://www.kauai.gov/Government/Departments-Agencies/Finance/Drivers-Licensing-and-Motor-Vehicles
  note: Kauai County runs separate driver licensing and motor vehicle services; modeled with exact Kauai County ZIPs.
  source: Division of Motor Vehicles (DMV) - Kauai County, HI
- Maui Electric Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hawaiianelectric.com/customer-service/maui-county-directory
  note: Maui Electric is the Maui County operating surface for Maui, Molokai, and Lanai; exact ZIPs are a prefilter and service address confirmation is required.
  source: Maui County Directory | Hawaiian Electric
- Hawaii Electric Light Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hawaiianelectric.com/customer-service/hawaii-island-directory
  note: Hawaii Electric Light serves Hawaii Island; exact ZIPs are a prefilter and service address confirmation is required.
  source: Hawaii Island Directory | Hawaiian Electric
- Kauai Island Utility Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://kiuc.coop/start-or-stop-service
  note: KIUC is the separate Kauai electric cooperative; exact ZIPs are a prefilter and service address confirmation is required.
  source: Start or Stop Service | Kauaʻi Island Utility Cooperative
- Department of Water Supply, County of Maui | UTILITY_WATER | newly_added | zip_prefix | https://www.mauicounty.gov/215/Fiscal-Division
  note: Maui County water customer service handles account, billing, start, stop, and transfer inquiries; exact ZIPs are a prefilter and service address confirmation is required.
  source: no-title | error: The operation was aborted due to timeout
- Department of Water Supply, County of Hawaii | UTILITY_WATER | newly_added | zip_prefix | https://customerconnect.hawaiidws.org/moving/start-service
  note: County of Hawaii DWS provides a start-service workflow and district customer service lines; exact ZIPs are a prefilter and service address confirmation is required.
  source: Department of Water Supply, County of Hawai'i > Main Menu > Manage Services > Stop, Start or Transfer Service > Start New Service
- Department of Water, County of Kauai | UTILITY_WATER | newly_added | zip_prefix | https://www.kauaiwater.org/sign-up-or-transfer-water-service/
  note: Kauai Department of Water provides sign-up and transfer workflows; exact ZIPs are a prefilter and service address confirmation is required.
  source: Sign Up or Transfer Water Service &#8211; Kauaʻi Department of Water
- Hawaii Department of Taxation | GOVERNMENT_TAX | newly_added | state | https://tax.hawaii.gov/faq/
  note: Official Hawaii state tax account and address-change surface; statewide for Hawaii residents and businesses.
  source: FAQs | Department of Taxation
- Hawaii Med-QUEST / KOLEA | GOVERNMENT_HEALTH | newly_added | state | https://medquest.hawaii.gov/en/members-applicants/already-covered/change-update-information.html
  note: Official Hawaii Medicaid/Med-QUEST account surface for reporting address and household changes through KOLEA or Med-QUEST support.
  source: Change/Update Your Information

### ID

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, Enbridge Gas Utah, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, CenturyLink (Lumen), Cox Communications, E-ZPass, Enbridge Gas Utah, Idaho Power, Intermountain Gas, Rocky Mountain Power, Spectrum, Starlink, Suez Idaho (Veolia), T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Idaho Power | UTILITY_ELECTRIC | newly_added | state | https://www.idahopower.com
  note: Idaho Power is the dominant investor-owned electric utility in southern Idaho and a major catalog gap.
  source: Idaho Power
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.
  source: Start, stop, or transfer energy services when moving | Avista

### IL

- Repo before: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Chicago Water Department, ComEd, CTA, E-ZPass, Frontier Communications, I-PASS, Illinois American Water, Metra, Nicor Gas, Pace Bus, Peoples Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Ameren Illinois, Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Chicago Water Department, ComEd, CTA, E-ZPass, Frontier Communications, I-PASS, Illinois American Water, Metra, Nicor Gas, Pace Bus, Peoples Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Ameren Illinois | UTILITY_ELECTRIC | newly_added | state | https://www.ameren.com/illinois/about
  note: Ameren Illinois is the major downstate Illinois electric utility and was not represented directly in seed.
  source: About Ameren - Ameren.com

### IN

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Citizens Energy Group, Duke Energy Indiana, E-ZPass, Frontier Communications, Indiana American Water, IndyGo, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Citizens Energy Group, Duke Energy Indiana, E-ZPass, Frontier Communications, Indiana American Water, Indiana Michigan Power, IndyGo, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Indiana Michigan Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.indianamichiganpower.com
  note: Indiana Michigan Power is a large AEP utility missing from Indiana coverage.
  source: Indiana Michigan Power

### IA

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Iowa, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Iowa American Water, Mediacom, MidAmerican Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Alliant Energy, Astound Broadband, AT&T Fiber, Black Hills Energy Iowa, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Iowa American Water, Mediacom, MidAmerican Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Alliant Energy | UTILITY_ELECTRIC | newly_added | state | https://www.alliantenergy.com/who-we-are/communities-we-serve
  note: Alliant Energy is a major Iowa/Wisconsin utility called out in state rules but missing from seed.
  source: Alliant Energy - Communities Served By Alliant Energy

### KS

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Evergy, Google Fiber, K-TAG, Kansas Gas Service, Midco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WaterOne, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Evergy, Google Fiber, K-TAG, Kansas Gas Service, Midco, RideKC, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WaterOne, WOW! Internet, Xfinity (Comcast)
- RideKC | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridekc.org/rider-guide/system-map
  note: Kansas City regional transit system missing from both Kansas and Missouri seed surfaces.
  source: System Map for RideKC | Rider Guide | RideKC

### KY

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Kentucky, E-ZPass, Kentucky Utilities, Louisville Water Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Kentucky, E-ZPass, Kentucky Utilities, Louisville Gas & Electric, Louisville Water Company, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Louisville Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://lge-ku.com
  note: LG&E is the core Louisville-area utility and was missing from Kentucky coverage.
  source: LG&amp;E and KU

### LA

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Louisiana, CenturyLink (Lumen), Cox Communications, E-ZPass, Entergy Louisiana, GeauxPass, New Orleans Regional Transit Authority, Sewerage & Water Board of New Orleans, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Louisiana, Capital Area Transit System, CenturyLink (Lumen), Cox Communications, E-ZPass, Entergy Louisiana, GeauxPass, New Orleans Regional Transit Authority, Sewerage & Water Board of New Orleans, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Capital Area Transit System | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.brcats.com
  note: Baton Rouge CATS expands Louisiana transit beyond the New Orleans region already in seed.
  source: Capital Area Transit System (CATS)

### ME

- Repo before: Astound Broadband, AT&T Fiber, Central Maine Power, Consolidated Communications VT, E-ZPass, Maine Water Company, Spectrum, Spectrum Maine, Starlink, Summit Natural Gas of Maine, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Versant Power, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Central Maine Power, Consolidated Communications VT, E-ZPass, Greater Portland METRO, Maine Water Company, Spectrum, Spectrum Maine, Starlink, Summit Natural Gas of Maine, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Versant Power, WOW! Internet, Xfinity (Comcast)
- Greater Portland METRO | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://gpmetro.org
  note: Greater Portland METRO adds a missing Maine transit provider with a compact service footprint.
  source: Home -Greater Portland Transit, ME | Official Website

### MD

- Repo before: Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities, Delmarva Power, E-ZPass, Pepco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- Repo after: Anne Arundel County Bureau of Utility Operations, Astound Broadband, AT&T Fiber, Baltimore Gas & Electric, Chesapeake Utilities, Choptank Electric Cooperative, Columbia Gas of Maryland, Delmarva Power, DriveEzMD, E-ZPass, Howard County Bureau of Utilities, Maryland American Water, MTA Maryland, Pepco, Potomac Edison, Southern Maryland Electric Cooperative, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Washington Gas, WMATA (Metro), WOW! Internet, WSSC Water, Xfinity (Comcast)
- MTA Maryland | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.mta.maryland.gov/transit-maps
  note: Maryland Transit Administration adds a missing Baltimore-centric transit surface.
  source: Transit Maps | Maryland Transit Administration
- DriveEzMD | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://driveezmd.com/sign-up/
  note: Maryland toll account surface for E-ZPass, Pay-By-Plate, and Video Toll activity; distinct from MDOT MVA driver/vehicle services.
  source: Create Your E-ZPass or Pay-By-Plate Account | DriveEzMD.com
- Potomac Edison | UTILITY_ELECTRIC | newly_added | live_address | https://www.firstenergycorp.com/potomac_edison.html
  note: Potomac Edison serves western Maryland and parts of West Virginia; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Potomac Edison
- Southern Maryland Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.smeco.coop/my-account/service-management/connect-service/
  note: SMECO serves Southern Maryland including Charles, St. Mary's, southern Prince George's, and most of Calvert County; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Connect Service &#8211; Southern Maryland Electric Cooperative
- Choptank Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://choptankelectric.coop/apply-service
  note: Choptank Electric Cooperative serves rural and suburban Maryland Eastern Shore communities; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Apply for Service | Choptank Electric Cooperative
- Columbia Gas of Maryland | UTILITY_GAS | newly_added | live_address | https://www.columbiagasmd.com/services/start-stop-or-move-service
  note: Columbia Gas of Maryland serves Garrett, Allegany, and Washington counties in western Maryland; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Start, Stop or Move Service - Columbia Gas of Maryland
- Anne Arundel County Bureau of Utility Operations | UTILITY_WATER | newly_added | live_address | https://www.aacounty.org/services/sewer-water
  note: Anne Arundel County water and wastewater service is county-scoped but address-specific; exact ZIPs are prefilters only.
  source: Sewer &amp; Water | Anne Arundel County Government
- Howard County Bureau of Utilities | UTILITY_WATER | newly_added | live_address | https://www.howardcountymd.gov/public-works/bureau-utilities
  note: Howard County public water and wastewater service covers most, but not all, county residents; exact ZIPs are prefilters and address confirmation is required.
  source: Bureau of Utilities | Howard County
- Maryland American Water | UTILITY_WATER | newly_added | live_address | https://amwater.com/mdaw/
  note: Maryland American Water has a small, non-contiguous footprint around Bel Air, Harford County, and Severn; exact ZIPs are conservative prefilters and service must be confirmed by address.
  source: Maryland American Water We Keep Life Flowing
- Prince George's County Residential Collections | UTILITY_TRASH | newly_added | live_address | https://www.princegeorgescountymd.gov/departments-offices/environment/waste-recycling/residential-collections
  note: Prince George's County residential collection applies to county-contracted collection areas; exact ZIPs are prefilters and address eligibility should be confirmed.
  source: Access Denied
- Baltimore County Bureau of Solid Waste Management | UTILITY_TRASH | newly_added | live_address | https://www.baltimorecountymd.gov/departments/public-works/solid-waste
  note: Baltimore County solid waste collection is county-scoped and distinct from Baltimore City sanitation; exact ZIPs are prefilters and address eligibility should be confirmed.
  source: ERROR: The request could not be satisfied

### MA

- Repo before: Astound Broadband, AT&T Fiber, Boston Water and Sewer Commission, E-ZPass, Eversource Energy, MBTA, National Grid Massachusetts, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of Massachusetts, Astound Broadband, AT&T Fiber, Berkshire Gas Company, Boston Water and Sewer Commission, Braintree Electric Light Department, Chicopee Electric Light, City of Cambridge Water Department, City of Somerville Water and Sewer Department, City of Worcester Water and Sewer Operations, E-ZPass, Eversource Energy, EZDriveMA / E-ZPass MA, Holyoke Gas and Electric, Liberty Utilities Massachusetts Gas, Massachusetts Water Resources Authority, MBTA, National Grid Massachusetts, Peabody Municipal Light Plant, Reading Municipal Light Department, Spectrum, Springfield Water and Sewer Commission, Starlink, T-Mobile Home Internet, Taunton Municipal Lighting Plant, Unitil Massachusetts, Verizon 5G Home Internet, Verizon Fios, Westfield Gas and Electric, WOW! Internet, Xfinity (Comcast)
- Massachusetts Water Resources Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.mwra.com
  note: MWRA covers Boston-region wholesale water/sewer service and adds a missing Massachusetts water surface.
  source: MWRA
- EZDriveMA / E-ZPass MA | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.mass.gov/ezdrivema
  note: Massachusetts toll account surface for E-ZPass MA and Pay By Plate; ZIP prefixes are Mass Pike and Boston-area toll corridor prefilters.
  source: Not allowed | Mass Gov
- Unitil Massachusetts | UTILITY_ELECTRIC | newly_added | zip_prefix | https://unitil.com/account-billing/start-stop-or-move-service
  note: Unitil serves specific Massachusetts electric and gas towns around Fitchburg/Gardner; exact ZIPs are a prefilter and service address confirmation is required.
  source: Start, Stop or Move Service | Unitil
- Berkshire Gas Company | UTILITY_GAS | newly_added | zip_prefix | https://www.berkshiregas.com/moving
  note: Berkshire Gas serves selected western Massachusetts communities; exact ZIPs are a prefilter and service address confirmation is required.
  source: no-title | error: The operation was aborted due to timeout
- Liberty Utilities Massachusetts Gas | UTILITY_GAS | newly_added | zip_prefix | https://massachusetts.libertyutilities.com/fall-river/residential/my-account/moving.html
  note: Liberty Massachusetts Gas serves localized Fall River and Blackstone-area gas territories; exact ZIPs are a prefilter and service address confirmation is required.
  source: Moving - Residential - Massachusetts Gas - Liberty
- Aquarion Water Company of Massachusetts | UTILITY_WATER | newly_added | zip_prefix | https://www.aquarionwater.com/customer-care/start-or-stop-service
  note: Aquarion Water Company of Massachusetts serves selected Massachusetts communities including parts of Dover, Millbury, Oxford, Plymouth, and Sheffield; exact ZIPs are a prefilter.
  source: Start or Stop Service | Aquarion Water
- Springfield Water and Sewer Commission | UTILITY_WATER | newly_added | zip_prefix | https://waterandsewer.org/request-service/
  note: Springfield Water and Sewer Commission serves Springfield and Ludlow-area water/sewer customers; exact ZIPs are a prefilter and service address confirmation is required.
  source: Request Service - Springfield Water and Sewer Commission
- City of Worcester Water and Sewer Operations | UTILITY_WATER | newly_added | zip_prefix | https://www.worcesterma.gov/water-sewer
  note: Worcester municipal water and sewer operations are city-scoped; exact ZIPs prevent statewide UI expansion.
  source: Water &amp; Sewer Operations | City of Worcester
- City of Cambridge Water Department | UTILITY_WATER | newly_added | zip_prefix | https://www.cambridgema.gov/departments/waterdepartment
  note: Cambridge Water Department is a city-owned water utility; exact ZIPs prevent Boston-area overmatching.
  source: Water Department - City of Cambridge, MA
- City of Somerville Water and Sewer Department | UTILITY_WATER | newly_added | zip_prefix | https://www.somervillema.gov/departments/water-and-sewer
  note: Somerville water/sewer billing and final bill workflows are city-scoped; exact ZIPs prevent Boston-area overmatching.
  source: Water and Sewer | City of Somerville
- Holyoke Gas and Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.hged.com/residential/start-stop-move-upgrade.aspx
  note: HG&E is the municipal electric/gas utility for Holyoke; exact ZIPs keep this local provider off unrelated Massachusetts moves.
  source: For your Home | Residential Start, Stop, Move, Upgrade | Holyoke Gas and Electric, Holyoke, Massachusetts
- Westfield Gas and Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.wgeld.org/forms/residential-start-stop-service/
  note: WG+E is the city-owned Westfield gas and electric utility; exact ZIPs keep it local.
  source: Page Not Found
- Peabody Municipal Light Plant | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pmlp.com/235/Sign-Up-for-Electrical-Service
  note: PMLP serves Peabody and South Lynnfield electric customers; exact ZIPs keep it local.
  source: Sign Up for Electrical Service | Peabody Municipal Light Plant, MA
- Taunton Municipal Lighting Plant | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.tmlp.com/162/Stop-Start-Service
  note: TMLP serves Taunton, Raynham, Berkley, and selected nearby areas; exact ZIPs are a local prefilter.
  source: Stop &amp; Start Service | TMLP, MA
- Reading Municipal Light Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.rmld.com/291/Start-or-Stop-Service
  note: RMLD serves Reading, North Reading, Wilmington, and Lynnfield Center; exact ZIPs keep it local.
  source: Start or Stop Service | RMLD, MA
- Chicopee Electric Light | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.celd.com/application-for-service
  note: Chicopee Electric Light is the municipal electric utility for Chicopee; exact ZIPs keep it local.
  source: Application for Service | Chicopee Electric
- Braintree Electric Light Department | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.beld.com/
  note: BELD is the municipal electric utility for Braintree; exact ZIPs keep it local.
  source: Braintree Electric Light Department &#8211; Your hometown electric provider
- City of Boston Public Works Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.boston.gov/departments/public-works/trash-and-recycling-day-schedule-and-search
  note: Boston trash and recycling schedule lookup is city-scoped; exact ZIPs prevent statewide display.
  source: Trash and Recycling Day Schedule and Search | Boston.gov
- City of Cambridge Curbside Collections | UTILITY_TRASH | newly_added | zip_prefix | https://www.cambridgema.gov/services/curbsidecollections
  note: Cambridge curbside trash, recycling, food waste, and yard waste service is city-scoped; exact ZIPs keep it local.
  source: Curbside Collections - City of Cambridge, MA
- City of Worcester Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.worcesterma.gov/trash-recycling
  note: Worcester trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
  source: Trash &amp; Recycling | City of Worcester
- City of Somerville Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.somervillema.gov/trash-and-recycling
  note: Somerville trash and recycling schedule is city-scoped; exact ZIPs keep it local.
  source: Somerville Trash &amp; Recycling Information | City of Somerville

### MI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Consumers Energy, DTE Energy, E-ZPass, Great Lakes Water Authority, SMART, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- SMART | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.smartbus.org/Routes-Schedules/System-Map
  note: Suburban Mobility Authority for Regional Transportation adds the Detroit suburban network missing from seed.
  source: 404 - File or directory not found.

### MN

- Repo before: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenterPoint Energy Minnesota, CenturyLink (Lumen), E-ZPass, Metro Transit MN, Midco, Minneapolis Water, Minnesota Energy Resources, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Minnesota Energy Resources | UTILITY_GAS | newly_added | state | https://www.minnesotaenergyresources.com
  note: Minnesota Energy Resources adds a missing statewide gas utility surface beyond CenterPoint.
  source: Minnesota Energy Resources

### MS

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy Mississippi, CenturyLink (Lumen), E-ZPass, Entergy Mississippi, Jackson Water, Mississippi Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy Mississippi, CenturyLink (Lumen), Coast Transit Authority, E-ZPass, Entergy Mississippi, Jackson Water, Mississippi Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Coast Transit Authority | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://coasttransit.com
  note: Mississippi Gulf Coast transit provider missing from seed.
  source: Coast Transit Authority

### MO

- Repo before: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Evergy, Google Fiber, Metro Transit St. Louis, Missouri American Water, Spectrum, Spire Missouri, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Ameren Missouri, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Evergy, Google Fiber, Metro Transit St. Louis, Missouri American Water, RideKC, Spectrum, Spire Missouri, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RideKC | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridekc.org/rider-guide/system-map
  note: Kansas City regional transit system missing from both Kansas and Missouri seed surfaces.
  source: System Map for RideKC | Rider Guide | RideKC

### MT

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Billings Water, E-ZPass, MDU Resources, NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of Billings Water, E-ZPass, MDU Resources, Mountain Line, NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Mountain Line | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://mountainline.com/system-map/
  note: Missoula-area transit addition for Montana.
  source: Page not found - Mountain Line

### NE

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy Nebraska, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Metropolitan Utilities District (Omaha), NorthWestern Energy, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy Nebraska, Black Hills Energy SD, CenturyLink (Lumen), Cox Communications, E-ZPass, Google Fiber, Metropolitan Utilities District (Omaha), NorthWestern Energy, Omaha Public Power District, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Omaha Public Power District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oppd.com/about/service-area/
  note: OPPD is a major Nebraska public-power provider missing from seed.

### NV

- Repo before: Astound Broadband, AT&T Fiber, Boulder City Utilities, Carson City Utility Billing, CenturyLink (Lumen), City of Henderson Utility Services, City of North Las Vegas Utilities Department, Cox Communications, E-ZPass, Google Fiber, Great Basin Water, Las Vegas Valley Water District, Lincoln County Power District No. 1, Mt. Wheeler Power, NV Energy, Overton Power District No. 5, RTC Southern Nevada, Southwest Gas, Spectrum, Starlink, T-Mobile Home Internet, Truckee Meadows Water Authority, Valley Electric Association, Verizon 5G Home Internet, Verizon Fios, Virgin Valley Water District, Wells Rural Electric Company, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Boulder City Utilities, Carson City Utility Billing, CenturyLink (Lumen), City of Henderson Utility Services, City of North Las Vegas Utilities Department, Cox Communications, E-ZPass, Google Fiber, Great Basin Water, Las Vegas Valley Water District, Lincoln County Power District No. 1, Mt. Wheeler Power, NV Energy, Overton Power District No. 5, RTC Southern Nevada, RTC Washoe, Southwest Gas, Spectrum, Starlink, T-Mobile Home Internet, Truckee Meadows Water Authority, Valley Electric Association, Verizon 5G Home Internet, Verizon Fios, Virgin Valley Water District, Wells Rural Electric Company, WOW! Internet, Xfinity (Comcast)
- RTC Washoe | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://rtcwashoe.com/public-transportation/system-map/
  note: RTC Washoe adds northern Nevada transit coverage beyond Las Vegas-area service already in seed.
  source: System Map With All Routes &#8211; RTC Washoe

### NH

- Repo before: Astound Broadband, AT&T Fiber, Consolidated Communications VT, E-ZPass, Eversource Energy New Hampshire Electric, Liberty Utilities New Hampshire Electric, Pennichuck Water Works, Spectrum, Starlink, T-Mobile Home Internet, Unitil Northern Utilities New Hampshire Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aquarion Water Company of New Hampshire, Astound Broadband, AT&T Fiber, City of Concord General Services Water and Sewer Utility Billing, COAST, Consolidated Communications VT, E-ZPass, Eversource Energy New Hampshire Electric, Hampstead Area Water Company, Liberty Utilities New Hampshire Electric, Liberty Utilities New Hampshire Gas, Manchester Water Works, New Hampshire Electric Cooperative, NH E-ZPass / New Hampshire Turnpike System, Pennichuck Water Works, Spectrum, Starlink, T-Mobile Home Internet, Unitil Energy Systems New Hampshire Electric, Unitil Northern Utilities New Hampshire Gas, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- COAST | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://coastbus.org/schedules
  note: COAST adds a New Hampshire transit provider for the Seacoast region.
  source: Bus Routes &amp; Map | COAST Bus - New Hampshire
- NH E-ZPass / New Hampshire Turnpike System | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ezpassnh.com/
  note: New Hampshire toll account and transponder surface; corridor ZIP prefixes keep it focused around NH Turnpike travel rather than every NH move.
- Unitil Energy Systems New Hampshire Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://unitil.com/account-billing/start-stop-or-move-service
  note: Unitil New Hampshire electric service is town and partial-town scoped; exact ZIPs are a prefilter and service address confirmation is required.
  source: Start, Stop or Move Service | Unitil
- New Hampshire Electric Cooperative | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.nhec.com/request-service/
  note: NHEC is a member-owned electric cooperative serving many rural NH communities; exact ZIPs are a prefilter and service address confirmation is required.
  source: Request Service | New Hampshire Electric Co-op
- Liberty Utilities New Hampshire Gas | UTILITY_GAS | newly_added | zip_prefix | https://new-hampshire.libertyutilities.com/pelham/residential/contact/service-requests/
  note: Liberty EnergyNorth natural gas service is separate from Liberty electric and should be confirmed by service address.
  source: Service Requests - Residential - New Hampshire Gas - Liberty
- Aquarion Water Company of New Hampshire | UTILITY_WATER | newly_added | zip_prefix | https://www.aquarionwater.com/customer-care/start-or-stop-service
  note: Aquarion's New Hampshire water communities are split from the Connecticut record; exact ZIPs are a prefilter and service address confirmation is required.
  source: Start or Stop Service | Aquarion Water
- Hampstead Area Water Company | UTILITY_WATER | newly_added | zip_prefix | https://www.hampsteadwater.com/new-service
  note: Hampstead Area Water serves selected southern NH towns and subdivisions; exact ZIPs are a prefilter and service address confirmation is required.
  source: Apply for New Water Service - Hampstead Area Water Company, Inc.
- Manchester Water Works | UTILITY_WATER | newly_added | zip_prefix | https://manchesterwater.org/start%2Fstop-service
  note: Manchester Water Works is city-scoped; exact ZIPs prevent statewide display.
  source: Start/Stop Service
- City of Manchester Sewer and Stormwater | UTILITY_SEWER | newly_added | zip_prefix | https://www.manchesternh.gov/Departments/sewer-and-stormwater
  note: Manchester sewer and stormwater billing is city-scoped and separate from water account support.
  source: Sewer and Stormwater
- City of Manchester Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.manchesternh.gov/Departments/Trash-and-Recycling/Trash-Collection
  note: Manchester trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
  source: Trash Collection
- City of Concord General Services Water and Sewer Utility Billing | UTILITY_WATER | newly_added | zip_prefix | https://www.concordnh.gov/1339/Utility-Billing
  note: Concord water and sewer utility billing is city-scoped; exact ZIPs prevent statewide display.
  source: Utility Billing | Concord, NH - Official Website
- City of Concord Trash and Recycling | UTILITY_TRASH | newly_added | zip_prefix | https://www.concordnh.gov/536/Trash-Recycling
  note: Concord trash and recycling service is city-scoped; exact ZIPs prevent statewide display.
  source: Trash &amp; Recycling | Concord, NH - Official Website
- City of Nashua Solid Waste Department | UTILITY_TRASH | newly_added | zip_prefix | https://www.nashuanh.gov/441/Residential-Collections
  note: Nashua solid waste collection is city-scoped; exact ZIPs prevent statewide display.
  source: Residential Collections | Nashua, NH
- City of Nashua Wastewater Department | UTILITY_SEWER | newly_added | zip_prefix | https://www.nashuanh.gov/392/Wastewater-Department
  note: Nashua wastewater support is city-scoped and separate from Pennichuck water service.
  source: Wastewater Department | Nashua, NH

### NJ

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Delaware River Joint Toll Bridge Commission, E-ZPass, Elizabethtown Gas, JCP&L, New Jersey American Water, NJ E-ZPass, NJ Natural Gas, NJ Transit, Optimum, Orange & Rockland, PATCO Speedline, PSE&G, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.
  source: DRPA | PATCO Transit Line
- Orange & Rockland | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oru.com
  note: Orange & Rockland serves Orange, Rockland, and Sullivan counties in New York plus northern New Jersey through Rockland Electric; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Orange &amp; Rockland - Utility Company Serving Greater New York
- Delaware River Joint Toll Bridge Commission | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.drjtbc.org/e-zpass/
  note: DRJTBC toll facilities are concentrated on Delaware River crossings between eastern Pennsylvania and New Jersey; account servicing is handled by the NJ E-ZPass customer service center.
  source: E-ZPass Information &#8211; DRJTBC

### NM

- Repo before: Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: ABQ RIDE, Albuquerque Bernalillo County Water Utility, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, El Paso Electric, New Mexico Gas Company, PNM, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- ABQ RIDE | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cabq.gov/transit/routes-and-schedules/system-map
  note: Albuquerque transit addition for New Mexico.
  source: Routes &amp; Schedules — City of Albuquerque
- El Paso Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.epelectric.com
  note: El Paso Electric serves the El Paso, Texas and southern New Mexico region; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Electricity for West Texas and Southern New Mexico | El Paso Electric | Welcome | Home

### NY

- Repo before: Astound Broadband, AT&T Fiber, Con Edison, E-ZPass, Frontier Communications, MTA, National Grid Upstate New York, NY E-ZPass, NYC Water Board, Optimum, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Central Hudson Gas & Electric, Con Edison, E-ZPass, Frontier Communications, MTA, National Fuel Gas Distribution Corporation, National Grid Metro New York Gas, National Grid Upstate New York, New York State Electric & Gas, NY E-ZPass, NYC Water Board, Optimum, Orange & Rockland, PSEG Long Island, Rochester Gas & Electric, Spectrum, Starlink, Suffolk County Water Authority, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- PSEG Long Island | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.psegliny.com
  note: Long Island electric utility surface missing from the seed's New York coverage.
  source: Home Page - PSEG Long Island
- National Grid Metro New York Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalgridus.com/NY-Home
  note: National Grid Metro/Downstate gas serves Brooklyn, Queens, Staten Island, and Long Island; ZIP prefixes are a prefilter because gas territory varies by borough/neighborhood and service address.
  source: Metro New York Gas | Home | National Grid
- Central Hudson Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cenhud.com
  note: Central Hudson serves a defined Mid-Hudson Valley territory from the northern NYC suburbs toward the Capital District; ZIP prefixes are a prefilter and service address confirmation is required.
- Orange & Rockland | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.oru.com
  note: Orange & Rockland serves Orange, Rockland, and Sullivan counties in New York plus northern New Jersey through Rockland Electric; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Orange &amp; Rockland - Utility Company Serving Greater New York
- New York State Electric & Gas | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.nyseg.com
  note: NYSEG serves more than 40% of upstate New York across many counties; ZIP prefixes are a broad prefilter and service address confirmation is required.
  source: no-title | error: The operation was aborted due to timeout
- Rochester Gas & Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.rge.com
  note: RG&E serves a nine-county Rochester-centered electric and gas territory; ZIP prefixes are a prefilter and service address confirmation is required.
  source: no-title | error: The operation was aborted due to timeout
- National Fuel Gas Distribution Corporation | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalfuel.com/utility/
  note: National Fuel Gas Distribution serves western New York and northwestern Pennsylvania natural gas customers; ZIP prefixes are a prefilter and service address confirmation is required.
  source: National Fuel | Heat Your Home or Business | Gas Company For WNY &amp; Northwest PA
- Suffolk County Water Authority | UTILITY_WATER | newly_added | zip_prefix | https://www.scwa.com
  note: SCWA serves Suffolk County water customers; ZIP prefixes are a prefilter and service address confirmation is required.
  source: SCWA | Suffolk County Water Authority

### NC

- Repo before: Aqua North Carolina, Astound Broadband, AT&T Fiber, Blue Ridge Energy, Brunswick Electric Membership Corporation, Carolina Water Service of North Carolina, CenturyLink (Lumen), Charlotte Water, City of Durham Department of Water Management, Dominion Energy North Carolina, Duke Energy North Carolina, E-ZPass, Enbridge Gas North Carolina, EnergyUnited, Frontier Natural Gas Company, Google Fiber, GoRaleigh, GoTriangle, Greensboro Water Resources, NC Quick Pass, Old North State Water Company, Orange Water and Sewer Authority, Piedmont Natural Gas, Raleigh Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Winston-Salem/Forsyth County Utilities, WOW! Internet, Xfinity (Comcast)
- Repo after: Aqua North Carolina, Astound Broadband, AT&T Fiber, Blue Ridge Energy, Brunswick Electric Membership Corporation, Carolina Water Service of North Carolina, CenturyLink (Lumen), Charlotte Water, City of Durham Department of Water Management, Dominion Energy North Carolina, Duke Energy North Carolina, E-ZPass, Enbridge Gas North Carolina, EnergyUnited, Frontier Natural Gas Company, Google Fiber, GoRaleigh, GoTriangle, Greensboro Water Resources, NC Quick Pass, Old North State Water Company, Orange Water and Sewer Authority, Piedmont Natural Gas, Raleigh Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Winston-Salem/Forsyth County Utilities, WOW! Internet, Xfinity (Comcast)
- Duke Energy North Carolina | UTILITY_ELECTRIC | already_present | live_address | https://www.duke-energy.com/start-stop-move/landing
  note: Duke Energy North Carolina is already present in the seed; service spans Duke Energy Carolinas and Progress territories and should be confirmed by address.
  source: Access Denied

### ND

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Fargo Water, MDU Resources, Midco, Montana-Dakota Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xcel Energy North Dakota Gas, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
  source: Home - Montana-Dakota Utilities Company

### OH

- Repo before: AEP Ohio, AES Ohio, Astound Broadband, AT&T Fiber, CenterPoint Energy Ohio, CenturyLink (Lumen), City of Columbus Water & Power, City of Toledo Department of Public Utilities, Cleveland Public Power, Cleveland Water Department, Columbia Gas of Ohio, COTA, Cox Communications, Duke Energy Ohio, E-ZPass, Enbridge Gas Ohio, FirstEnergy Ohio Utilities, Frontier Communications, Greater Cincinnati Water Works, Ohio Turnpike E-ZPass, RTA Cleveland, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: AEP Ohio, AES Ohio, Astound Broadband, AT&T Fiber, CenterPoint Energy Ohio, CenturyLink (Lumen), City of Columbus Water & Power, City of Toledo Department of Public Utilities, Cleveland Public Power, Cleveland Water Department, Columbia Gas of Ohio, COTA, Cox Communications, Duke Energy Ohio, E-ZPass, Enbridge Gas Ohio, FirstEnergy Ohio Utilities, Frontier Communications, Greater Cincinnati Water Works, Ohio Turnpike E-ZPass, RTA Cleveland, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Ohio Turnpike E-ZPass | TRANSPORTATION_TOLL | already_present | zip_prefix | https://www.ezpassoh.com/
  note: Ohio Turnpike E-ZPass is already present in the seed and is corridor-scoped rather than a statewide household utility.
  source: E-ZPass - Ohio Turnpike

### OK

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, E-ZPass, EMBARK, OG&E, Oklahoma City Utilities, Oklahoma Natural Gas (ONE Gas), Public Service Oklahoma (PSO), Spectrum, Starlink, T-Mobile Home Internet, Tulsa Water, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- EMBARK | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://embarkok.com/system-map/
  note: Oklahoma City EMBARK adds a missing Oklahoma transit provider.
  source: EMBARK | System Map

### OR

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), City of Portland Water Bureau, E-ZPass, Frontier Communications, NW Natural, Portland General Electric, Spectrum, Starlink, T-Mobile Home Internet, TriMet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, Avista Utilities Oregon Gas, BreezeBy Electronic Tolling, Cascade Natural Gas, Central Lincoln People's Utility District, CenturyLink (Lumen), City of Bend Water Services, City of Gresham Utility Services, City of Hillsboro Utility Billing, City of Portland Water Bureau, City of Salem Utility Service, Consumers Power Inc., E-ZPass, Eugene Water & Electric Board, Frontier Communications, Idaho Power Oregon Service Area, Lane Electric Cooperative, Medford Water, NW Natural, Oregon Trail Electric Cooperative, Pacific Power, Portland General Electric, Spectrum, Springfield Utility Board, Starlink, T-Mobile Home Internet, Tillamook People's Utility District, TriMet, Tualatin Valley Water District, Umatilla Electric Cooperative, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Pacific Power | UTILITY_ELECTRIC | newly_added | live_address | https://www.pacificpower.net/my-account/start-stop-move.html
  note: Pacific Power serves many Oregon communities outside the Portland General Electric footprint; ZIP prefixes are broad prefilters and service should be confirmed by address.
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.
  source: Start, stop, or transfer energy services when moving | Avista
- BreezeBy Electronic Tolling | TRANSPORTATION_TOLL | newly_added | polygon | https://www.portofhoodriver.com/about-breezeby-electronic-bridge-tolling
  note: BreezeBy is the Columbia River bridge toll account surface for Hood River-White Salmon Bridge and Bridge of the Gods corridor users.
  source: About BreezeBy Electronic Bridge Tolling - Port of Hood River
- Idaho Power Oregon Service Area | UTILITY_ELECTRIC | newly_added | live_address | https://www.idahopower.com/accounts-service/start-stop-transfer/
  note: Idaho Power has an eastern Oregon service area; keep it distinct from Oregon Trail Electric until any service-area transfer is completed operationally.
  source: Start, Stop, Move - Idaho Power
- Avista Utilities Oregon Gas | UTILITY_GAS | newly_added | live_address | https://www.myavista.com/your-account/moving
  note: Avista's Oregon utility service is address-qualified and should remain distinct from Cascade Natural Gas and NW Natural.
  source: Start, stop, or transfer energy services when moving | Avista
- Eugene Water & Electric Board | UTILITY_ELECTRIC | newly_added | live_address | https://www.eweb.org/start-stop
  note: EWEB is Eugene's electric and water utility; service should be confirmed by address, especially near Lane Electric boundaries.
  source: Start, Stop or Move My Service | EWEB
- Springfield Utility Board | UTILITY_ELECTRIC | newly_added | live_address | https://www.subutil.com/customer-service/start-stop-service/
  note: Springfield Utility Board provides municipal electric and water service in Springfield; exact service is address-specific.
  source: Start/Stop Service &#8211; Springfield Utility Board
- Central Lincoln People's Utility District | UTILITY_ELECTRIC | newly_added | live_address | https://clpud.org/customer-information/start-or-stop-service/
  note: Central Lincoln PUD serves coastal Oregon communities; ZIPs are broad coastal prefilters and service should be confirmed by address.
  source: Start or Stop Service &#8211; Central Lincoln
- Tillamook People's Utility District | UTILITY_ELECTRIC | newly_added | live_address | https://www.tpud.org/customer-service/start-or-stop-service/
  note: Tillamook PUD service is local and address-specific across Tillamook County and nearby areas.
  source: Start or Stop Service &#8211; Tillamook People&#039;s Utility District
- Oregon Trail Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.otec.coop/
  note: OTEC is an eastern Oregon electric cooperative; keep distinct from Idaho Power while the Oregon service-area transfer remains an operational change to monitor.
  source: Home | Oregon Trail Electric Cooperative
- Umatilla Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.umatillaelectric.com/member-services/start-stop-service/
  note: Umatilla Electric Cooperative serves selected northeastern Oregon addresses; ZIPs are prefilters.
  source: Start/Stop Service &#8211; Umatilla Electric Cooperative
- Consumers Power Inc. | UTILITY_ELECTRIC | newly_added | live_address | https://cpi.coop/service/stop-service
  note: Consumers Power Inc. serves selected Oregon addresses in multiple operating zones; address confirmation is required.
  source: Start / Stop Service | Consumers Power Inc.
- Lane Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.laneelectric.com/member-services/new-member-guide/
  note: Lane Electric serves rural Lane County and surrounding areas; service should be confirmed by address near EWEB and Springfield Utility Board boundaries.
  source: New Member Guide &#8211; Lane Electric Cooperative
- City of Salem Utility Service | UTILITY_WATER | newly_added | live_address | https://www.cityofsalem.net/community/household/water-utilities/utility-payments-and-your-utility-account/manage-your-city-of-salem-utility-service-account
  note: City of Salem utility account setup is municipal and should be confirmed by service address.
  source: Access Denied
- City of Bend Water Services | UTILITY_WATER | newly_added | live_address | https://bendoregon.gov/service/water-sewer-start-or-stop-service/
  note: Bend water and sewer service is municipal and address-specific.
  source: Water/Sewer START or STOP service - City of Bend
- Medford Water | UTILITY_WATER | newly_added | live_address | https://www.medfordwater.org/services/customer-service/
  note: Medford Water service is regional and should be confirmed by service address.
  source: Customer Service -Medford Water
- Tualatin Valley Water District | UTILITY_WATER | newly_added | live_address | https://www.tvwd.org/district/page/startstop-service-interim-billing
  note: TVWD is a Washington County-area water district; address confirmation is required near Beaverton and other providers.
  source: Just a moment...
- City of Hillsboro Utility Billing | UTILITY_WATER | newly_added | live_address | https://www.hillsboro-oregon.gov/services/utility-billing/start-or-stop-service
  note: Hillsboro utility billing is municipal and should be confirmed by service address.
  source: Access Denied
- City of Gresham Utility Services | UTILITY_WATER | newly_added | live_address | https://www.greshamoregon.gov/services/utilities/stop-or-start-utility-services/
  note: Gresham utility services cover municipal water, wastewater/sewer, and stormwater for eligible addresses.
  source: Stop or Start Utility Services | City of Gresham

### PA

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, PECO Energy, Pennsylvania Turnpike Commission E-ZPass, Philadelphia Water Department, Pittsburgh Regional Transit, Pittsburgh Water & Sewer, PPL Electric Utilities, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Aqua Pennsylvania, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Columbia Gas of Pennsylvania, Delaware River Joint Toll Bridge Commission, Duquesne Light Company, E-ZPass, Frontier Communications, Met-Ed, National Fuel Gas Distribution Corporation, PATCO Speedline, PECO Energy, Penelec, Penn Power, Pennsylvania American Water, Pennsylvania Turnpike Commission E-ZPass, Peoples Natural Gas, Philadelphia Gas Works, Philadelphia Water Department, Pittsburgh Regional Transit, Pittsburgh Water & Sewer, PPL Electric Utilities, SEPTA, Spectrum, Starlink, T-Mobile Home Internet, UGI Utilities, Verizon 5G Home Internet, Verizon Fios, West Penn Power, WOW! Internet, Xfinity (Comcast)
- PATCO Speedline | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.drpa.org/patco/index.html
  note: PATCO adds a missing NJ/PA rail corridor provider between South Jersey and Philadelphia.
  source: DRPA | PATCO Transit Line
- Columbia Gas of Pennsylvania | UTILITY_GAS | newly_added | zip_prefix | https://www.columbiagaspa.com
  note: Columbia Gas of Pennsylvania serves selected Pennsylvania communities; ZIP prefixes are a prefilter and service availability should be confirmed by address.
  source: Home - Columbia Gas of Pennsylvania
- National Fuel Gas Distribution Corporation | UTILITY_GAS | newly_added | zip_prefix | https://www.nationalfuel.com/utility/
  note: National Fuel Gas Distribution serves western New York and northwestern Pennsylvania natural gas customers; ZIP prefixes are a prefilter and service address confirmation is required.
  source: National Fuel | Heat Your Home or Business | Gas Company For WNY &amp; Northwest PA
- Duquesne Light Company | UTILITY_ELECTRIC | newly_added | zip_prefix | https://duquesnelight.com/service-reliability
  note: Duquesne Light serves Allegheny and Beaver counties; ZIP prefixes are a prefilter and service address confirmation is required.
- Met-Ed | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/met_edison.html
  note: Met-Ed is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
  source: Met Edison
- Penelec | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/penelec.html
  note: Penelec is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
  source: Penelec
- Penn Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/penn_power.html
  note: Penn Power is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
  source: Penn Power
- West Penn Power | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.firstenergycorp.com/west_penn_power.html
  note: West Penn Power is a FirstEnergy Pennsylvania electric distribution utility; ZIP prefixes are drawn from official territory lists and require address confirmation.
  source: West Penn Power
- Peoples Natural Gas | UTILITY_GAS | newly_added | zip_prefix | https://www.peoples-gas.com/my-account/start-or-modify-gas-service
  note: Peoples Natural Gas serves parts of western Pennsylvania; ZIP prefixes are a prefilter and service availability should be confirmed by address.
  source: Start or Modify Gas Service | Peoples
- Philadelphia Gas Works | UTILITY_GAS | newly_added | zip_prefix | https://www.pgworks.com/customer-care/your-home/service
  note: Philadelphia Gas Works is city-scoped to Philadelphia natural gas customers.
  source: Start/Stop Service | PGW (Philadelphia Gas Works)
- Aqua Pennsylvania | UTILITY_WATER | newly_added | live_address | https://www.aquawater.com/start-or-stop-service
  note: Aqua Pennsylvania has a fragmented water and wastewater footprint across Pennsylvania, so service should be confirmed by address.
  source: Start Or Stop Service | Aqua
- Pennsylvania American Water | UTILITY_WATER | newly_added | live_address | https://www.amwater.com/paaw/customer-service-billing/
  note: Pennsylvania American Water serves many non-contiguous water and wastewater communities, so service should be confirmed by address.
  source: Pennsylvania American Water Customer Service & Billing
- Delaware River Joint Toll Bridge Commission | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.drjtbc.org/e-zpass/
  note: DRJTBC toll facilities are concentrated on Delaware River crossings between eastern Pennsylvania and New Jersey; account servicing is handled by the NJ E-ZPass customer service center.
  source: E-ZPass Information &#8211; DRJTBC

### RI

- Repo before: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Cox Communications, E-ZPass, Providence Water, Rhode Island Energy, Rhode Island Energy Gas, RIPTA, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- RIPTA | TRANSPORTATION_TRANSIT | newly_added | state | https://ripta.com/statewide-system-map/
  note: RIPTA provides statewide Rhode Island transit service and should exist explicitly in seed.
  source: 403 Forbidden

### SC

- Repo before: Astound Broadband, AT&T Fiber, Beaufort-Jasper Water & Sewer Authority, Berkeley Electric Cooperative, Blue Ridge Electric Cooperative, Charleston Water System, Columbia Water, Dominion Energy South Carolina, Dominion Energy South Carolina Gas, Duke Energy South Carolina, E-ZPass, Fort Hill Natural Gas Authority, Grand Strand Water & Sewer Authority, Greenville Water, Horry Electric Cooperative, Lancaster County Natural Gas Authority, Laurens Electric Cooperative, Mid-Carolina Electric Cooperative, Mount Pleasant Waterworks, Palmetto Electric Cooperative, Piedmont Natural Gas, Santee Cooper, Santee Electric Cooperative, Southern Connector / Palmetto Pass, Spartanburg Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast), York County Natural Gas Authority, York Electric Cooperative
- Repo after: Astound Broadband, AT&T Fiber, Beaufort-Jasper Water & Sewer Authority, Berkeley Electric Cooperative, Blue Ridge Electric Cooperative, CARTA, Charleston Water System, Columbia Water, Dominion Energy South Carolina, Dominion Energy South Carolina Gas, Duke Energy South Carolina, E-ZPass, Fort Hill Natural Gas Authority, Grand Strand Water & Sewer Authority, Greenville Water, Horry Electric Cooperative, Lancaster County Natural Gas Authority, Laurens Electric Cooperative, Mid-Carolina Electric Cooperative, Mount Pleasant Waterworks, Palmetto Electric Cooperative, Piedmont Natural Gas, Santee Cooper, Santee Electric Cooperative, Southern Connector / Palmetto Pass, Spartanburg Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast), York County Natural Gas Authority, York Electric Cooperative
- CARTA | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridecarta.com
  note: Charleston Area Regional Transportation Authority adds a South Carolina transit option beyond utility-only coverage.
  source: CARTA &#8211; Charleston Area Regional Transportation Authority

### SD

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, E-ZPass, MDU Resources, MDU Resources South Dakota Gas, Midco, NorthWestern Energy, Sioux Falls Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, E-ZPass, MDU Resources, MDU Resources South Dakota Gas, Midco, Montana-Dakota Utilities, NorthWestern Energy, Sioux Area Metro, Sioux Falls Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
  source: Home - Montana-Dakota Utilities Company
- Sioux Area Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.siouxfalls.gov/sam
  note: Sioux Falls transit surface for South Dakota.
  source: Sioux Area Metro - City of Sioux Falls

### TN

- Repo before: Astound Broadband, AT&T Fiber, E-ZPass, Google Fiber, Nashville Electric Service, Nashville Water Services, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WeGo Public Transit, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, E-ZPass, Google Fiber, Memphis Light, Gas and Water, Nashville Electric Service, Nashville Water Services, Piedmont Natural Gas Tennessee, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WeGo Public Transit, WOW! Internet, Xfinity (Comcast)
- Memphis Light, Gas and Water | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mlgw.com
  note: MLGW is a major missing Memphis-area multi-utility provider.
  source: Welcome to MLGW

### TX

- Repo before: Astound Broadband, AT&T Fiber, Atmos Energy, Austin Water, CapMetro, CenterPoint Energy, CenturyLink (Lumen), Dallas Water Utilities, DART, E-ZPass, Frontier Communications, Google Fiber, Houston METRO, Houston Public Works, Reliant Energy, San Antonio Water System, Spectrum, Starlink, T-Mobile Home Internet, Trinity Metro, TxTag, TXU Energy, Verizon 5G Home Internet, Verizon Fios, VIA Metropolitan Transit, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Atmos Energy, Austin Energy, Austin Water, CapMetro, CenterPoint Energy, CenturyLink (Lumen), CPS Energy, Dallas Water Utilities, DART, E-ZPass, El Paso Electric, El Paso Water, Fort Worth Water, Frontier Communications, Google Fiber, Harris County Toll Road Authority, Houston METRO, Houston Public Works, North Texas Tollway Authority, Reliant Energy, San Antonio Water System, Spectrum, Starlink, T-Mobile Home Internet, Texas Gas Service, Trinity Metro, TxTag, TXU Energy, Verizon 5G Home Internet, Verizon Fios, VIA Metropolitan Transit, WOW! Internet, Xfinity (Comcast)
- North Texas Tollway Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.ntta.org
  note: NTTA adds a Dallas-Fort Worth toll corridor provider beyond statewide Texas toll tags.
  source: NTTA | NTTA
- Oncor Electric Delivery | UTILITY_ELECTRIC | catalog_backlog | polygon | https://www.oncor.com
  note: Oncor is a critical Texas delivery utility, but its territory should be polygon-modeled rather than blindly state-scoped.
  source: no-title | error: The operation was aborted due to timeout
- Texas Department of Motor Vehicles | GOVERNMENT_DMV | newly_added | state | https://www.txdmv.gov
  note: Official Texas vehicle title, registration, registration-address, and county tax office resource; complements Texas DPS driver-license coverage.
  source: TxDMV Home | TxDMV.gov
- Harris County Toll Road Authority | TRANSPORTATION_TOLL | newly_added | zip_prefix | https://www.hctra.org
  note: HCTRA is a Houston/Harris County toll account provider; ZIP prefixes are a prefilter and account/vehicle details must be confirmed.
  source: HCTRA &mdash; Harris County Toll Road Authority
- Austin Energy | UTILITY_ELECTRIC | newly_added | zip_prefix | https://austinenergy.com
  note: Austin Energy serves Austin plus portions of Travis and Williamson counties; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Austin Energy
- CPS Energy | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cpsenergy.com
  note: CPS Energy serves San Antonio and portions of adjoining counties for electric and gas service; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Welcome to CPS Energy
- Fort Worth Water | UTILITY_WATER | newly_added | zip_prefix | https://www.fortworthtexas.gov/departments/water
  note: Fort Worth Water provides water and wastewater service in Fort Worth plus wholesale service around Tarrant-area communities; address confirmation is required.
  source: Water – Welcome to the City of Fort Worth
- El Paso Electric | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.epelectric.com
  note: El Paso Electric serves the El Paso, Texas and southern New Mexico region; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Electricity for West Texas and Southern New Mexico | El Paso Electric | Welcome | Home
- El Paso Water | UTILITY_WATER | newly_added | zip_prefix | https://www.epwater.org
  note: El Paso Water is city/region-scoped; ZIP prefixes are a prefilter and service address confirmation is required.
  source: El Paso Water | Home
- Texas Gas Service | UTILITY_GAS | newly_added | zip_prefix | https://www.texasgasservice.com
  note: Texas Gas Service serves specific Texas communities across Central Gulf, North Texas, Rio Grande Valley, and West Texas areas; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Texas Gas Service

### UT

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Enbridge Gas Utah, Google Fiber, Rocky Mountain Power, Salt Lake City Department of Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), City of St. George Utilities, E-ZPass, Enbridge Gas Utah, Google Fiber, Provo City Utilities, Rocky Mountain Power, Salt Lake City Department of Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, UDOT Express Pass, UTA, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- UDOT Express Pass | TRANSPORTATION_TOLL | newly_added | polygon | https://www.expresspass.utah.gov/
  note: Utah Express Pass is the I-15 Express Lanes toll account/transponder surface; ZIPs are Wasatch Front corridor prefilters rather than statewide coverage.
  source: Customer Service Center v2.0.85 Built: 2025-08-04_0517
- Utah DMV Motor Vehicle Portal | GOVERNMENT_DMV | newly_added | state | https://mvp.tax.utah.gov/
  note: Separate statewide vehicle title, registration, renewal, and vehicle-address-change workflow; paired with Utah Driver License Division rather than replacing it.
  source: Motor Vehicle Portal
- Provo City Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://www.provo.gov/181/City-Utilities
  note: Provo utility setup is municipal and address-specific; ZIPs are city prefilters for electric, water, wastewater, and garbage account setup.
  source: City Utilities | Provo, UT
- City of St. George Utilities | UTILITY_ELECTRIC | newly_added | live_address | https://sgcityutah.gov/departments/apply_for_utility_services.php
  note: City utility application covers most St. George electric, water, sewer, and garbage service addresses; ZIPs are local prefilters.
  source: St. George, UT - Apply for Utility Services
- Wasatch Front Waste & Recycling District | UTILITY_TRASH | newly_added | live_address | https://wfwrdutah.gov/services-and-request/services-requests
  note: WFWRD serves selected Salt Lake County cities and unincorporated areas; ZIPs are prefilters and service should be confirmed by address.
  source: Services and Request | Wasatch Front Waste &amp; Recycling District

### VT

- Repo before: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Burlington Department of Public Works Water, Consolidated Communications VT, E-ZPass, Green Mountain Power, Green Mountain Transit, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Vermont Gas Systems, WOW! Internet, Xfinity (Comcast)
- Green Mountain Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://ridegmt.com
  note: Green Mountain Transit adds a Vermont transit provider beyond utility-only coverage.
  source: Green Mountain Transit – Getting you where you need to go!

### VA

- Repo before: Appalachian Power, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), Cox Communications, Dominion Energy Virginia, E-ZPass, Fairfax Water, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power, Arlington County Water-Sewer-Refuse Utility, Astound Broadband, AT&T Fiber, Central Virginia Electric Cooperative, CenturyLink (Lumen), City of Virginia Beach Public Utilities, Columbia Gas of Virginia, Cox Communications, Dominion Energy Virginia, E-ZPass, E-ZPass Virginia, Fairfax Water, Hampton Roads Transit, Loudoun Water, Northern Virginia Electric Cooperative, Old Dominion Power, Prince William Water, Rappahannock Electric Cooperative, Richmond Gas Works, Roanoke Gas Company, Shenandoah Valley Electric Cooperative, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, Virginia American Water, Virginia Natural Gas, Washington Gas, WMATA (Metro), WOW! Internet, Xfinity (Comcast)
- E-ZPass Virginia | TRANSPORTATION_TOLL | newly_added | live_address | https://www.ezpassva.com/
  note: Virginia E-ZPass is the statewide toll account issuer for Virginia toll facilities; account relevance depends on address and driving/toll use rather than residence utility territory.
  source: Home | E-ZPass® Virginia
- Old Dominion Power | UTILITY_ELECTRIC | newly_added | live_address | https://lge-ku.com/odp
  note: Old Dominion Power is the Virginia customer-facing KU electric surface; exact ZIPs are southwest Virginia prefilters and service should be confirmed by address.
  source: Programs, Services and Information for ODP Customers | LG&amp;E and KU
- Northern Virginia Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.novec.com/Customer_Services/Apply-for-Service.cfm
  note: NOVEC serves selected Northern Virginia cooperative territories; exact ZIPs are prefilters and service should be confirmed by address.
  source: Apply for Service
- Rappahannock Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.myrec.coop/startstop-service
  note: REC serves portions of many Virginia counties; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start/Stop Service | myrec
- Shenandoah Valley Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.svec.coop/member-services/start-stop-service/
  note: SVEC is a Shenandoah Valley cooperative electric provider; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start/Stop Service &#8211; Shenandoah Valley Electric Cooperative
- Central Virginia Electric Cooperative | UTILITY_ELECTRIC | newly_added | live_address | https://www.mycvec.com/member-services/start-stop-move-service/
  note: CVEC serves portions of central Virginia counties; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start, Stop, Move Service &#8211; Central Virginia Electric Cooperative
- Virginia Natural Gas | UTILITY_GAS | newly_added | live_address | https://www.virginianaturalgas.com/residential/manage-your-account/start-stop-transfer-service.html
  note: Virginia Natural Gas serves selected southeastern Virginia addresses; exact ZIPs are prefilters and gas availability should be confirmed by address.
  source: Start, Stop or Transfer Service
- Columbia Gas of Virginia | UTILITY_GAS | newly_added | live_address | https://www.columbiagasva.com/services/start-stop-or-move-service
  note: Columbia Gas of Virginia has non-contiguous gas territories; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start, Stop or Move Service - Columbia Gas of Virginia
- Roanoke Gas Company | UTILITY_GAS | newly_added | live_address | https://www.roanokegas.com/become-a-customer/residential-service/
  note: Roanoke Gas is regional and address-qualified; exact ZIPs are Roanoke-area prefilters.
  source: Residential Service - Roanoke Gas
- Richmond Gas Works | UTILITY_GAS | newly_added | live_address | https://richmondgasworks.com/service/start-stop-transfer-service/
  note: Richmond Gas Works serves Richmond-area gas customers; exact ZIPs are metro prefilters and service should be confirmed by address.
  source: Start, Stop or Transfer Service – existing meter - Richmond Gas Works
- Loudoun Water | UTILITY_WATER | newly_added | live_address | https://www.loudounwater.org/content/start-service
  note: Loudoun Water serves designated water and sewer areas outside incorporated towns; exact ZIPs are prefilters and service should be confirmed by address.
  source: Start Service | loudounwater.org
- Prince William Water | UTILITY_WATER | newly_added | live_address | https://princewilliamwater.org/our-customers/how-to/start-service
  note: Prince William Water serves most of Prince William County, but exact utility eligibility should be confirmed by address.
  source: Start Service | Prince William Water
- City of Virginia Beach Public Utilities | UTILITY_WATER | newly_added | live_address | https://pu.virginiabeach.gov/customer-service/online-services
  note: Virginia Beach Public Utilities provides water and sanitary sewer workflows for city service addresses; exact ZIPs are city prefilters.
  source: Online Services | City of Virginia Beach
- Arlington County Water-Sewer-Refuse Utility | UTILITY_WATER | newly_added | live_address | https://www.arlingtonva.us/Government/Programs/Water-Utilities/Customer-Service/Start-Stop-Service
  note: Arlington utility accounts cover water, sewer, and refuse for county service addresses; exact ZIPs are county prefilters.
  source: Start or Stop Service – Official Website of Arlington County Virginia Government
- Hampton Roads Sanitation District | UTILITY_SEWER | newly_added | live_address | https://www.hrsd.com/customers
  note: HRSD is a regional wastewater utility; exact ZIPs are Hampton Roads/Eastern Shore prefilters and billing/service applicability should be confirmed by address.
  source: Customer Landing Page | HRSD
- City of Virginia Beach Waste Management | UTILITY_TRASH | newly_added | live_address | https://pw.virginiabeach.gov/trash-recycling
  note: Virginia Beach trash and recycling service applies to eligible city residential addresses; exact ZIPs are city prefilters.
  source: Trash &amp; Recycling | City of Virginia Beach
- Hampton Roads Transit | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://gohrt.com/routes/
  note: HRT expands Virginia transit coverage beyond DC-region rail providers.
  source: Routes &#8211; Hampton Roads Transit

### WA

- Repo before: Astound Broadband, AT&T Fiber, Cascade Natural Gas, CenturyLink (Lumen), E-ZPass, Frontier Communications, Good To Go!, NW Natural, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Avista Utilities, Benton PUD, BreezeBy Electronic Tolling, Cascade Natural Gas, CenturyLink (Lumen), Chelan County PUD, City of Spokane Utilities, Clark Public Utilities, Cowlitz County Public Utility District, E-ZPass, Frontier Communications, Good To Go!, Grant PUD, King County Metro, Lewis County PUD, Mason County PUD No. 3, NW Natural, Pacific Power Washington, Puget Sound Energy, Seattle City Light, Seattle Public Utilities, Snohomish County PUD, Spectrum, Starlink, T-Mobile Home Internet, Tacoma Public Utilities, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- King County Metro | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://kingcounty.gov/en/dept/metro
  note: King County Metro adds the largest Washington transit network beyond Seattle-only utilities.
  source: Metro - King County, Washington
- Snohomish County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.snopud.com/account/my-account/start-stop-service/
  note: Snohomish County PUD provides electric service to all of Snohomish County and Camano Island plus selected water systems; modeled with exact local ZIPs and address confirmation.
  source: Start / Stop / Transfer Service - Snohomish County PUD
- Tacoma Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.mytpu.org/payment-billing/start-stop-service/
  note: Tacoma Public Utilities handles power and water account workflows for Tacoma-area movers; exact ZIPs are a prefilter and service address confirmation is required.
  source: Start/Stop Service - Tacoma Public Utilities
- Clark Public Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.clarkpublicutilities.com/start-stop-transfer-service/
  note: Clark Public Utilities provides electric service throughout Clark County and water service in selected areas; modeled with exact Clark County ZIPs and address confirmation.
  source: Start, Stop or Transfer Service - Clark Public Utilities
- Avista Utilities | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.myavista.com/your-account/moving
  note: Avista provides electric and natural gas service across eastern Washington, northern Idaho, and parts of Oregon; ZIP prefixes are regional prefilters and service address confirmation is required.
  source: Start, stop, or transfer energy services when moving | Avista
- Pacific Power Washington | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pacificpower.net/my-account/start-stop-move.html
  note: Pacific Power serves south-central and southeastern Washington communities around Yakima and Walla Walla; separate WA row avoids changing the existing Oregon-focused seed entry.
- City of Spokane Utilities | UTILITY_WATER | newly_added | zip_prefix | https://my.spokanecity.org/publicworks/utility-billing/
  note: City of Spokane utility billing covers water, wastewater, stormwater, and solid waste for city and adjacent service customers; exact ZIPs are a prefilter and address confirmation is required.
- Chelan County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.chelanpud.org/my-pud-services/start-stop-services
  note: Chelan County PUD provides electric service and selected water/wastewater systems in Chelan County; modeled with exact county ZIPs and address confirmation.
  source: Start/Stop Services
- Grant PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.grantpud.org/start-stop-service
  note: Grant PUD provides start, stop, and transfer workflows for Grant County electric customers; modeled with exact local ZIPs and address confirmation.
  source: Start/Stop Service
- Benton PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.bentonpud.org/manage-my-account/start-stop-service
  note: Benton PUD provides electric start, stop, and transfer workflows for Kennewick, Prosser, and surrounding Benton County areas; exact ZIPs are a prefilter.
  source: Benton PUD - Start &amp; Stop Service
- Cowlitz County Public Utility District | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.cowlitzpud.org/new-services/start-stop-or-transfer-service/
  note: Cowlitz PUD provides county electric start, stop, and transfer workflows; modeled with exact Cowlitz County ZIPs and address confirmation.
  source: Start, Stop or Transfer Service &#8211; Cowlitz County Public Utility District
- Lewis County PUD | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.lcpud.org/services/start-stop-service/
  note: Lewis County PUD is a regional public electric utility; exact ZIPs are a conservative prefilter because Centralia City Light and other municipal overlaps exist.
  source: Start/Stop Service &#8211; Lewis County PUD
- Mason County PUD No. 3 | UTILITY_ELECTRIC | newly_added | zip_prefix | https://www.pud3.org/electric-service/electric-start-new-service/
  note: Mason PUD 3 serves most of Mason County and small adjacent areas; modeled with exact local ZIPs and address confirmation.
  source: Start or Stop Electric Service &#8211; Mason County PUD No. 3
- BreezeBy Electronic Tolling | TRANSPORTATION_TOLL | newly_added | polygon | https://www.portofhoodriver.com/about-breezeby-electronic-bridge-tolling
  note: BreezeBy is the Columbia River bridge toll account surface for Hood River-White Salmon Bridge and Bridge of the Gods corridor users.
  source: About BreezeBy Electronic Bridge Tolling - Port of Hood River

### WV

- Repo before: Appalachian Power, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountaineer Gas, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Repo after: Appalachian Power, Astound Broadband, AT&T Fiber, E-ZPass, Frontier Communications, Mon Power, Mountain Line Transit Authority, Mountaineer Gas, Potomac Edison, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, West Virginia American Water, WOW! Internet, Xfinity (Comcast)
- Mountain Line Transit Authority | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://busride.org/routes/
  note: West Virginia transit addition centered on Morgantown.
- Potomac Edison | UTILITY_ELECTRIC | newly_added | live_address | https://www.firstenergycorp.com/potomac_edison.html
  note: Potomac Edison serves western Maryland and parts of West Virginia; ZIP prefixes are a prefilter and service address confirmation is required.
  source: Potomac Edison

### WI

- Repo before: Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Repo after: Alliant Energy, Astound Broadband, AT&T Fiber, CenturyLink (Lumen), E-ZPass, Frontier Communications, Midco, Milwaukee County Transit System, Milwaukee Water Works, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, We Energies, Wisconsin Public Service Gas, WOW! Internet, Xcel Energy ND, Xfinity (Comcast)
- Alliant Energy | UTILITY_ELECTRIC | newly_added | state | https://www.alliantenergy.com/who-we-are/communities-we-serve
  note: Alliant Energy is a major Iowa/Wisconsin utility called out in state rules but missing from seed.
  source: Alliant Energy - Communities Served By Alliant Energy

### WY

- Repo before: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, E-ZPass, Enbridge Gas Utah, MDU Resources, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Repo after: Astound Broadband, AT&T Fiber, Black Hills Energy SD, Cheyenne Board of Public Utilities, Cheyenne Transit Program, E-ZPass, Enbridge Gas Utah, MDU Resources, Montana-Dakota Utilities, Rocky Mountain Power, Source Gas Distribution Wyoming, Spectrum, Starlink, T-Mobile Home Internet, Verizon 5G Home Internet, Verizon Fios, WOW! Internet, Xfinity (Comcast)
- Montana-Dakota Utilities | UTILITY_GAS | newly_added | state | https://www.montana-dakota.com
  note: Montana-Dakota Utilities closes a multi-state utility gap across the northern plains.
  source: Home - Montana-Dakota Utilities Company
- Cheyenne Transit Program | TRANSPORTATION_TRANSIT | newly_added | zip_prefix | https://www.cheyennecity.org/Your-Government/Departments/Public-Works/Transit/Fixed-Route-Service
  note: Cheyenne Transit Program adds a Wyoming public transit surface beyond utilities.
  source: Fixed Route Service – City of Cheyenne

