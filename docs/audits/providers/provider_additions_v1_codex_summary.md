# Provider Additions V1 Codex Review

Generated: 2026-05-07T02:23:56.482Z

## Inputs Read

- Batch 1 rows reviewed: 76
- Candidate rows available for comparison: 381
- Rejected-resource rows kept out of implementation: 265
- Existing-update rows reviewed separately/not bulk-implemented: 133
- Current provider seed count before implementation: 792
- Current generated coverage row count before implementation: 1567
- Controlled import files absent: yes

## Decision Counts

- ADD_NEW_ACTIVE: 51
- ADD_NEW_MANUAL_REVIEW: 3
- UPDATE_EXISTING_ONLY: 17
- SKIP_ALREADY_EXISTS: 1
- REJECT_RESOURCE_ONLY: 4

## Implementation Plan

- Add active rows only from Batch 1 into the state provider catalog as idempotent seed records.
- Keep manual-review rows as catalog-only entries with no seedRecord, so they are hidden from public recommendations and do not generate moving tasks.
- Do not import rejected-resource rows or any Batch 2/Batch 3 rows.
- Do not recreate controlled-provider-import.ts or controlled-provider-import-data.ts.
- Fold duplicate same-domain/action-page candidates into existing provider rows instead of adding duplicate providers.
- Use ZIP prefixes/exact ZIPs from the Batch 1 CSV; all utility entries retain cautious address-check language.

## Active Adds

- whittier-tunnel-ak | AK | TRANSPORTATION_TOLL | Anton Anderson Memorial Tunnel / Whittier Tunnel
- alabama-dor-motor-vehicle | AL | GOVERNMENT_DMV | Alabama Department of Revenue Motor Vehicle Division
- alabama-freedom-pass | AL | TRANSPORTATION_TOLL | Alabama Freedom Pass
- 91-express-lanes | CA | TRANSPORTATION_TOLL | 91 Express Lanes
- metro-expresslanes | CA | TRANSPORTATION_TOLL | Metro ExpressLanes
- the-toll-roads-orange-county | CA | TRANSPORTATION_TOLL | The Toll Roads
- e-470 | CO | TRANSPORTATION_TOLL | E-470 Public Highway Authority
- northwest-parkway | CO | TRANSPORTATION_TOLL | Northwest Parkway
- access-health-ct | CT | GOVERNMENT_HEALTH | Access Health CT
- husky-health-ct | CT | GOVERNMENT_HEALTH | HUSKY Health
- ct-drs | CT | GOVERNMENT_TAX | Connecticut Department of Revenue Services
- dc-health-link | DC | GOVERNMENT_HEALTH | DC Health Link
- dc-district-direct | DC | GOVERNMENT_HEALTH | District Direct
- mytax-dc | DC | GOVERNMENT_TAX | MyTax.DC.gov
- delaware-medicaid-assist | DE | GOVERNMENT_HEALTH | Delaware Medicaid / ASSIST
- delaware-taxpayer-portal | DE | GOVERNMENT_TAX | Delaware Taxpayer Portal
- delaware-ezpass | DE | TRANSPORTATION_TOLL | Delaware E-ZPass
- florida-kidcare | FL | GOVERNMENT_HEALTH | Florida KidCare
- florida-myaccess-medicaid | FL | GOVERNMENT_HEALTH | Florida Medicaid / MyACCESS
- florida-dor-eservices | FL | GOVERNMENT_TAX | Florida DOR e-Services
- epass-cfx | FL | TRANSPORTATION_TOLL | E-PASS / Central Florida Expressway Authority
- greater-miami-expressway-agency | FL | TRANSPORTATION_TOLL | Greater Miami Expressway Agency
- i4-express | FL | TRANSPORTATION_TOLL | I-4 Express
- tampa-hillsborough-expressway-authority | FL | TRANSPORTATION_TOLL | Tampa Hillsborough Expressway Authority
- alaska-electric-light-power | AK | UTILITY_ELECTRIC | Alaska Electric Light and Power
- golden-valley-electric-association | AK | UTILITY_ELECTRIC | Golden Valley Electric Association
- homer-electric-association | AK | UTILITY_ELECTRIC | Homer Electric Association
- ketchikan-public-utilities-electric | AK | UTILITY_ELECTRIC | Ketchikan Public Utilities Electric
- matanuska-electric-association | AK | UTILITY_ELECTRIC | Matanuska Electric Association
- interior-gas-utility | AK | UTILITY_GAS | Interior Gas Utility
- decatur-utilities-electric | AL | UTILITY_ELECTRIC | Decatur Utilities Electric
- huntsville-utilities-electric | AL | UTILITY_ELECTRIC | Huntsville Utilities Electric
- conway-corp-electric | AR | UTILITY_ELECTRIC | Conway Corp Electric
- north-little-rock-electric | AR | UTILITY_ELECTRIC | North Little Rock Electric
- swepco-ar | AR | UTILITY_ELECTRIC | Southwestern Electric Power Company (SWEPCO)
- arkansas-oklahoma-gas | AR | UTILITY_GAS | Arkansas Oklahoma Gas
- tucson-electric-power | AZ | UTILITY_ELECTRIC | Tucson Electric Power
- unisource-electric-az | AZ | UTILITY_ELECTRIC | UniSource Energy Services Electric
- smud | CA | UTILITY_ELECTRIC | Sacramento Municipal Utility District
- jewett-city-dpu-electric | CT | UTILITY_ELECTRIC | Jewett City Department of Public Utilities
- norwich-public-utilities-electric | CT | UTILITY_ELECTRIC | Norwich Public Utilities
- wallingford-electric-division | CT | UTILITY_ELECTRIC | Wallingford Electric Division
- city-of-dover-electric | DE | UTILITY_ELECTRIC | City of Dover Electric Department
- city-of-milford-electric | DE | UTILITY_ELECTRIC | City of Milford Electric
- city-of-newark-electric | DE | UTILITY_ELECTRIC | City of Newark Electric
- delaware-electric-cooperative | DE | UTILITY_ELECTRIC | Delaware Electric Cooperative
- lewes-bpw-electric | DE | UTILITY_ELECTRIC | Lewes Board of Public Works Electric
- new-castle-msc-electric | DE | UTILITY_ELECTRIC | Municipal Services Commission of the City of New Castle Electric
- town-of-middletown-electric | DE | UTILITY_ELECTRIC | Town of Middletown Electric
- town-of-smyrna-electric | DE | UTILITY_ELECTRIC | Town of Smyrna Electric
- florida-city-gas | FL | UTILITY_GAS | Florida City Gas

## Manual Review / Hidden Catalog Only

- southeast-gas | AL | UTILITY_GAS | Southeast Gas | Real gas utility but batch has unknown territory; keep catalog-only/manual review until ZIP/service-area is confirmed.
- summit-utilities-arkansas | AR | UTILITY_GAS | Summit Utilities Arkansas | Real gas utility but batch has unknown territory; keep catalog-only/manual review until ZIP/service-area is confirmed.
- cng-ct | CT | UTILITY_GAS | Connecticut Natural Gas | Real gas utility but batch territory is unknown and existing catalog entry is backlog only; keep hidden/manual review until ZIPs are confirmed.

## Existing-Only / Duplicate Avoidance

- dc-dmv-change-of-address -> dmv-dc | UPDATE_EXISTING_ONLY | Existing DC DMV provider covers official address and vehicle actions; avoid action-page duplicate.
- dc-dmv-registration-renewal -> dmv-dc | UPDATE_EXISTING_ONLY | Existing DC DMV provider covers registration actions; avoid action-page duplicate.
- dc-dmv-vehicle-services -> dmv-dc | UPDATE_EXISTING_ONLY | Existing DC DMV provider covers vehicle services; avoid action-page duplicate.
- dc-office-of-tax-and-revenue -> mytax-dc | UPDATE_EXISTING_ONLY | Agency information belongs behind the MyTax account provider; avoid duplicate tax rows.
- dc-real-property-tax-address-change -> mytax-dc | UPDATE_EXISTING_ONLY | Specific address-change action is covered by the MyTax account provider; avoid action-page duplicate.
- mytax-dc-mailing-address-change -> mytax-dc | UPDATE_EXISTING_ONLY | Specific mailing-address action is covered by the MyTax account provider; avoid action-page duplicate.
- dc-water-service-information-rates -> dc-water | UPDATE_EXISTING_ONLY | Existing DC Water provider covers account/service actions; candidate is an info/rates surface.
- delaware-division-of-revenue -> delaware-taxpayer-portal | UPDATE_EXISTING_ONLY | Agency information belongs behind the taxpayer portal; avoid duplicate tax rows.
- us-301-toll-by-plate -> delaware-ezpass | UPDATE_EXISTING_ONLY | Same toll account/payment domain as Delaware E-ZPass; avoid separate facility duplicate.
- flhsmv-address-change -> dmv-fl | UPDATE_EXISTING_ONLY | Existing Florida DHSMV provider covers address changes; avoid action-page duplicate.
- mydmv-portal-florida -> dmv-fl | UPDATE_EXISTING_ONLY | Existing Florida DHSMV provider covers MyDMV actions; avoid portal duplicate.
- florida-department-of-revenue -> florida-dor-eservices | UPDATE_EXISTING_ONLY | Agency information belongs behind DOR e-Services; avoid duplicate tax rows.
- huntsville-utilities-gas -> huntsville-utilities-electric | UPDATE_EXISTING_ONLY | Same provider/domain/account as Huntsville Utilities; fold gas into the added utility row.
- unisource-gas-az -> unisource-electric-az | UPDATE_EXISTING_ONLY | Same provider/domain/account as UniSource electric; fold gas into the added utility row.
- sdge-gas -> sdge | UPDATE_EXISTING_ONLY | Existing SDG&E seed row already covers electric and gas; avoid same-domain duplicate.
- washington-gas-convert-to-gas -> washington-gas | UPDATE_EXISTING_ONLY | Existing Washington Gas provider covers account/service actions; avoid marketing/action-page duplicate.
- delmarva-power-gas-de -> delmarva-power-de | UPDATE_EXISTING_ONLY | Existing Delmarva Power row already owns the same domain; update existing row rather than adding duplicate gas row.
- united-illuminating-ct -> ui-ct | SKIP_ALREADY_EXISTS | Existing state catalog seed row already adds United Illuminating.

## Rejected From Implementation

- dc-dhcf | DC Department of Health Care Finance | Agency/program information page; District Direct is the real account surface for benefit updates.
- dc-health-care-alliance | DC Health Care Alliance | Program information page; District Direct is the account surface.
- choose-health-delaware | Choose Health Delaware | General outreach/resource surface; Delaware Medicaid ASSIST is the account provider.
- florida-ahca-medicaid | Florida Agency for Health Care Administration Medicaid | Agency information page; MyACCESS/KidCare are account surfaces.

## Cleanliness Notes

- No PSC/PUC/regulator-only, broadband-map, directory, scam/no-provider, route-map-only, what-goes-where, report-a-problem, or general info rows are planned for ServiceProvider import.
- No rejected-resource CSV rows are planned for import.
- Utility/toll rows with incomplete territory are ZIP/corridor scoped or held for manual review.
