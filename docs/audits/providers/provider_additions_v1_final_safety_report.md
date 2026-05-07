# Provider Additions V1 Batch 1 Final Safety Report

Node note: Node 22.x was not available in this shell. Final commands were run with Node v24.12.0 and pnpm 9.15.0; each pnpm command emitted the expected unsupported-engine warning but exited 0.

Final counts after Batch 1: raw providers 843, sanitized providers 842, coverage rows 1,767. Baseline before Batch 1 was raw providers 792, sanitized providers 791, coverage rows 1,567.

## 1. Added active provider rows

All 51 active rows below are real account, service, toll, utility, tax, health, DMV, or official address-action surfaces. None are PSC/PUC/regulator, broadband map, directory, supplier-choice info, scam/no-provider, route-map-only transit, report-a-problem, or general info pages.

| # | State | Slug | Name | Category | Scope | Coverage model | ZIP prefixes / states added | Address check required | Why real account/service/address-action provider |
|---|---|---|---|---|---|---|---|---|---|
| 1 | AK | whittier-tunnel-ak | Anton Anderson Memorial Tunnel / Whittier Tunnel | TRANSPORTATION_TOLL | STATE | zip_prefix | 996 | No | Toll/payment surface for vehicle access and account/payment details. |
| 2 | AL | alabama-dor-motor-vehicle | Alabama Department of Revenue Motor Vehicle Division | GOVERNMENT_DMV | STATE | state | AL | No | Official vehicle registration and motor-vehicle tax/address action surface. |
| 3 | AL | alabama-freedom-pass | Alabama Freedom Pass | TRANSPORTATION_TOLL | STATE | state | AL | No | Real toll pass account for transponder, vehicle, payment, and mailing details. |
| 4 | CA | 91-express-lanes | 91 Express Lanes | TRANSPORTATION_TOLL | STATE | zip_prefix | 925, 928 | No | Toll account provider for transponder, vehicle, payment, and mailing details. |
| 5 | CA | metro-expresslanes | Metro ExpressLanes | TRANSPORTATION_TOLL | STATE | zip_prefix | 900, 905, 907 | No | Toll account provider for Los Angeles express-lane account details. |
| 6 | CA | the-toll-roads-orange-county | The Toll Roads | TRANSPORTATION_TOLL | STATE | zip_prefix | 926, 927 | No | Toll road account provider for transponder, vehicle, payment, and mailing details. |
| 7 | CO | e-470 | E-470 Public Highway Authority | TRANSPORTATION_TOLL | STATE | zip_prefix | 800, 801, 802 | No | Toll account provider for license plate, vehicle, payment, and mailing details. |
| 8 | CO | northwest-parkway | Northwest Parkway | TRANSPORTATION_TOLL | STATE | zip_prefix | 800, 803 | No | Toll road account/payment surface for vehicle and mailing details. |
| 9 | CT | access-health-ct | Access Health CT | GOVERNMENT_HEALTH | STATE | zip_prefix | 060, 061, 062, 063, 064, 065, 066, 067, 068, 069 | No | Official Connecticut health marketplace account and address update portal. |
| 10 | CT | husky-health-ct | HUSKY Health | GOVERNMENT_HEALTH | STATE | zip_prefix | 060, 061, 062, 063, 064, 065, 066, 067, 068, 069 | No | Official Medicaid/HUSKY account and address/profile surface. |
| 11 | CT | ct-drs | Connecticut Department of Revenue Services | GOVERNMENT_TAX | STATE | zip_prefix | 060, 061, 062, 063, 064, 065, 066, 067, 068, 069 | No | Official tax account and address update surface. |
| 12 | DC | dc-health-link | DC Health Link | GOVERNMENT_HEALTH | STATE | zip_prefix | 200, 202, 203, 204, 205 | No | Official health marketplace account and address update portal. |
| 13 | DC | dc-district-direct | District Direct | GOVERNMENT_HEALTH | STATE | zip_prefix | 200, 202, 203, 204, 205 | No | Official benefits/health account portal for profile and address updates. |
| 14 | DC | mytax-dc | MyTax.DC.gov | GOVERNMENT_TAX | STATE | zip_prefix | 200, 202, 203, 204, 205 | No | Official tax account and mailing address update portal. |
| 15 | DE | delaware-medicaid-assist | Delaware Medicaid / ASSIST | GOVERNMENT_HEALTH | STATE | zip_prefix | 197, 198, 199 | No | Official benefits and Medicaid account/address portal. |
| 16 | DE | delaware-taxpayer-portal | Delaware Taxpayer Portal | GOVERNMENT_TAX | STATE | zip_prefix | 197, 198, 199 | No | Official taxpayer account and address update portal. |
| 17 | DE | delaware-ezpass | Delaware E-ZPass | TRANSPORTATION_TOLL | STATE | zip_prefix | 197, 198, 199 | No | Toll account provider for transponder, vehicle, payment, and mailing details. |
| 18 | FL | florida-kidcare | Florida KidCare | GOVERNMENT_HEALTH | STATE | zip_prefix | 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 341, 342, 344, 346, 347, 349 | No | Official child health insurance account and address update surface. |
| 19 | FL | florida-myaccess-medicaid | Florida Medicaid / MyACCESS | GOVERNMENT_HEALTH | STATE | zip_prefix | 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 341, 342, 344, 346, 347, 349 | No | Official benefits and Medicaid account/address portal. |
| 20 | FL | florida-dor-eservices | Florida DOR e-Services | GOVERNMENT_TAX | STATE | zip_prefix | 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 341, 342, 344, 346, 347, 349 | No | Official Florida tax e-services account portal. |
| 21 | FL | epass-cfx | E-PASS / Central Florida Expressway Authority | TRANSPORTATION_TOLL | STATE | zip_prefix | 327, 328, 347 | No | Toll account provider for transponder, vehicle, payment, and mailing details. |
| 22 | FL | greater-miami-expressway-agency | Greater Miami Expressway Agency | TRANSPORTATION_TOLL | STATE | zip_prefix | 330, 331, 332 | No | Miami-area toll account/payment surface for vehicle and mailing details. |
| 23 | FL | i4-express | I-4 Express | TRANSPORTATION_TOLL | STATE | zip_prefix | 327, 328 | No | Toll account/payment surface for vehicle and mailing details. |
| 24 | FL | tampa-hillsborough-expressway-authority | Tampa Hillsborough Expressway Authority | TRANSPORTATION_TOLL | STATE | zip_prefix | 335, 336 | No | Tampa-area toll account/payment surface for vehicle and mailing details. |
| 25 | AK | alaska-electric-light-power | Alaska Electric Light and Power | UTILITY_ELECTRIC | STATE | zip_prefix | 998 | Yes | Electric utility account; users can start/stop/transfer service and manage billing/address. |
| 26 | AK | golden-valley-electric-association | Golden Valley Electric Association | UTILITY_ELECTRIC | STATE | zip_prefix | 997 | Yes | Electric cooperative account; users can manage service, billing, and address details. |
| 27 | AK | homer-electric-association | Homer Electric Association | UTILITY_ELECTRIC | STATE | zip_prefix | 996 | Yes | Electric cooperative account; users can manage service, billing, and address details. |
| 28 | AK | ketchikan-public-utilities-electric | Ketchikan Public Utilities Electric | UTILITY_ELECTRIC | STATE | zip_prefix | 999 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 29 | AK | matanuska-electric-association | Matanuska Electric Association | UTILITY_ELECTRIC | STATE | zip_prefix | 995, 996 | Yes | Electric cooperative account; users can manage service, billing, and address details. |
| 30 | AK | interior-gas-utility | Interior Gas Utility | UTILITY_GAS | STATE | zip_prefix | 997 | Yes | Gas utility account; users can manage service, billing, and address details. |
| 31 | AL | decatur-utilities-electric | Decatur Utilities Electric | UTILITY_ELECTRIC | STATE | zip_prefix | 356 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 32 | AL | huntsville-utilities-electric | Huntsville Utilities | UTILITY_ELECTRIC | STATE | zip_prefix | 357, 358 | Yes | Municipal multi-utility account for electric, gas, and water; duplicate gas row folded in. |
| 33 | AR | conway-corp-electric | Conway Corp Electric | UTILITY_ELECTRIC | STATE | zip_prefix | 720 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 34 | AR | north-little-rock-electric | North Little Rock Electric | UTILITY_ELECTRIC | STATE | zip_prefix | 721 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 35 | AR | swepco-ar | Southwestern Electric Power Company (SWEPCO) | UTILITY_ELECTRIC | STATE | zip_prefix | 718, 727 | Yes | Electric utility account; users can manage service, billing, and address details. |
| 36 | AR | arkansas-oklahoma-gas | Arkansas Oklahoma Gas | UTILITY_GAS | STATE | zip_prefix | 729 | Yes | Gas utility account; users can manage service, billing, and address details. |
| 37 | AZ | tucson-electric-power | Tucson Electric Power | UTILITY_ELECTRIC | STATE | zip_prefix | 856, 857 | Yes | Electric utility account; users can manage service, billing, and address details. |
| 38 | AZ | unisource-electric-az | UniSource Energy Services | UTILITY_ELECTRIC | STATE | zip_prefix | 856, 864 | Yes | Electric and natural gas utility account; duplicate gas row folded in. |
| 39 | CA | smud | Sacramento Municipal Utility District | UTILITY_ELECTRIC | STATE | zip_prefix | 956, 957, 958 | Yes | Electric utility account; users can manage service, billing, and address details. |
| 40 | CT | jewett-city-dpu-electric | Jewett City Department of Public Utilities | UTILITY_ELECTRIC | STATE | zip_prefix | 063 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 41 | CT | norwich-public-utilities-electric | Norwich Public Utilities | UTILITY_ELECTRIC | STATE | zip_prefix | 063 | Yes | Municipal utility account; users can manage service, billing, and address details. |
| 42 | CT | wallingford-electric-division | Wallingford Electric Division | UTILITY_ELECTRIC | STATE | zip_prefix | 064 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 43 | DE | city-of-dover-electric | City of Dover Electric Department | UTILITY_ELECTRIC | STATE | exact_zip | 19901, 19904 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 44 | DE | city-of-milford-electric | City of Milford Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19963 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 45 | DE | city-of-newark-electric | City of Newark Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19711, 19713, 19716, 19717 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 46 | DE | delaware-electric-cooperative | Delaware Electric Cooperative | UTILITY_ELECTRIC | STATE | zip_prefix | 199 | Yes | Electric cooperative account; users can manage service, billing, and address details. |
| 47 | DE | lewes-bpw-electric | Lewes Board of Public Works Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19958 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 48 | DE | new-castle-msc-electric | Municipal Services Commission of the City of New Castle Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19720 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 49 | DE | town-of-middletown-electric | Town of Middletown Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19709, 19734 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 50 | DE | town-of-smyrna-electric | Town of Smyrna Electric | UTILITY_ELECTRIC | STATE | exact_zip | 19977 | Yes | Municipal electric utility account; users can manage service, billing, and address details. |
| 51 | FL | florida-city-gas | Florida City Gas | UTILITY_GAS | STATE | zip_prefix | 330, 331, 332, 333, 334, 349 | Yes | Gas utility account; users can manage service, billing, and address details. |

## 2. Existing/duplicate avoided

17 UPDATE_EXISTING_ONLY rows and 1 SKIP_ALREADY_EXISTS row were not added as duplicate ServiceProvider records.

| Decision | Proposed slug | Existing/covered by | Seed data changed? |
|---|---|---|---|
| UPDATE_EXISTING_ONLY | dc-dmv-change-of-address | dmv-dc | No. Existing DC DMV row already covers the official DMV address/action surface. |
| UPDATE_EXISTING_ONLY | dc-dmv-registration-renewal | dmv-dc | No. Skipped as an action-page duplicate. |
| UPDATE_EXISTING_ONLY | dc-dmv-vehicle-services | dmv-dc | No. Skipped as an action-page duplicate. |
| UPDATE_EXISTING_ONLY | dc-office-of-tax-and-revenue | mytax-dc | No existing row changed; covered by the new consolidated MyTax.DC.gov account row. |
| UPDATE_EXISTING_ONLY | dc-real-property-tax-address-change | mytax-dc | No. Folded into MyTax.DC.gov; no separate row. |
| UPDATE_EXISTING_ONLY | mytax-dc-mailing-address-change | mytax-dc | No. Folded into MyTax.DC.gov; no separate row. |
| UPDATE_EXISTING_ONLY | dc-water-service-information-rates | dc-water | No. Existing DC Water provider already covers the account/service surface. |
| UPDATE_EXISTING_ONLY | delaware-division-of-revenue | delaware-taxpayer-portal | No. Covered by the new Delaware Taxpayer Portal account row. |
| UPDATE_EXISTING_ONLY | us-301-toll-by-plate | delaware-ezpass | No. Covered by Delaware E-ZPass as the trackable toll account surface. |
| UPDATE_EXISTING_ONLY | flhsmv-address-change | dmv-fl | No. Existing Florida DMV row already covers official DMV address/action behavior. |
| UPDATE_EXISTING_ONLY | mydmv-portal-florida | dmv-fl | No. Existing Florida DMV row already covers the portal/action surface. |
| UPDATE_EXISTING_ONLY | florida-department-of-revenue | florida-dor-eservices | No. Covered by the new Florida DOR e-Services account row. |
| UPDATE_EXISTING_ONLY | huntsville-utilities-gas | huntsville-utilities-electric | Yes, safely folded into the new Huntsville Utilities multi-utility row; no duplicate gas row added. |
| UPDATE_EXISTING_ONLY | unisource-gas-az | unisource-electric-az | Yes, safely folded into the new UniSource electric/gas row; no duplicate gas row added. |
| UPDATE_EXISTING_ONLY | sdge-gas | sdge | No. Existing SDG&E provider already covers electric and gas. |
| UPDATE_EXISTING_ONLY | washington-gas-convert-to-gas | washington-gas | No. Existing Washington Gas provider already covers gas account action. |
| UPDATE_EXISTING_ONLY | delmarva-power-gas-de | delmarva-power-de | Yes, small existing-provider update in providers.ts: description/tags now include natural gas; no duplicate gas row added. |
| SKIP_ALREADY_EXISTS | united-illuminating-ct | ui-ct | No. Existing catalog seed row already adds United Illuminating; only skipped. |

## 3. Rejected rows

Rejected resource-only rows:

| Slug | Name | Reason |
|---|---|---|
| dc-dhcf | DC Department of Health Care Finance | Agency/program info page; District Direct is the real account surface. |
| dc-health-care-alliance | DC Health Care Alliance | Program information page; District Direct is the account surface. |
| choose-health-delaware | Choose Health Delaware | Outreach/resource surface; Delaware Medicaid ASSIST is the account provider. |
| florida-ahca-medicaid | Florida Agency for Health Care Administration Medicaid | Agency information page; MyACCESS/KidCare are account surfaces. |

Confirmed: these slugs are absent from providers.ts, state-provider-catalog.ts active/catalog entries, generated ServiceProvider seed output, and generated active catalog JSON. The only matches are in provider_additions_v1_codex_review.csv as rejected rows.

## 4. Manual-review / catalog-only rows

Manual-review/catalog-only rows:

| State | Name | Category | Catalog behavior |
|---|---|---|---|
| AL | Southeast Gas | UTILITY_GAS | Catalog-only backlog, coverageModel live_address, no seedRecord. |
| AR | Summit Utilities Arkansas | UTILITY_GAS | Catalog-only backlog, coverageModel live_address, no seedRecord. |
| CT | Connecticut Natural Gas | UTILITY_GAS | Existing catalog-only backlog, official URL updated to cngcorp.com, no seedRecord. |

Confirmed: these are not active normal recommendations, not service-add candidates, not onboarding auto-suggest rows, and not moving-task creators because they do not produce ServiceProvider seed records. Generated docs list them as catalog_backlog/catalog-only, which is explicit backlog behavior.

## 5. Banned resource check

Searches covered the Batch 1 seed diff, provider seed files, generated JSON, and the rejected slugs. None of the banned resource classes were imported as active Batch 1 providers:

- PSC / PUC / commission / regulator-only pages: none. The only diff hit for "commission" is the municipal utility provider name "Municipal Services Commission of the City of New Castle Electric", which is a real electric account provider, not a regulator.
- broadband maps/offices: none.
- utility directories: none.
- supplier-choice info pages: none.
- scam/no-provider warnings: none.
- what-goes-where / educational pages: none.
- report-a-problem pages: none.
- route-map-only transit pages: none in Batch 1 active additions.
- general city/county info with no account/service action: none.

Generated state-completeness docs still mention pre-existing completeness-catalog transit rows from before Batch 1, but those were not added by the Batch 1 provider import and are not part of the 51 Batch 1 active rows.

## 6. Transit check

Batch 1 added 0 TRANSPORTATION_TRANSIT providers. The 51 ADD_NEW_ACTIVE rows contain government health/tax/DMV, toll, electric, and gas providers only.

No route-map-only/local transit resource was imported by Batch 1. Existing state-completeness catalog transit rows still appear in generated docs because the audit reports all catalog seed expansions, including rows that predate Batch 1. I did not move or alter those because this safety pass was constrained to Batch 1 and no seed edits unless a real blocker was found.

## 7. Coverage safety

Coverage safety checks:

- New utility rows use cautious address-confirmation language such as "confirm service availability by address".
- New utility rows include address-check semantics in tags and are marked addressCheckRequired Yes in the review inventory.
- New toll rows are scoped by corridor ZIP prefixes where Batch 1 supplied usable prefixes; Alabama Freedom Pass is state-scoped but audit flags it as broad state coverage, not guaranteed service.
- New government health/tax/DMV rows are official state or district account/address-action surfaces, not utility service claims.
- City and municipal utilities are not modeled as statewide; they use city-area ZIP prefixes or exact ZIPs.
- ZIP prefixes are treated as recommendation scoping only, not proof of service. Users must still confirm service area/address eligibility where applicable.
- No new internet rows were added in Batch 1.
- UTILITY_TRASH was not introduced in Batch 1, and UTILITY_WASTE was not used.

## 8. Generated docs check

Generated docs changed because of substantive provider additions and catalog diff content, not timestamp-only churn. The regenerated docs include the 51 Batch 1 additions plus the existing completeness-catalog seed expansion report. Because the changes are content-bearing, they were not restored.

Changed generated docs:

- docs/generated/state-provider-completeness-catalog.json
- docs/generated/state-provider-completeness-catalog.md
- docs/generated/state-provider-seed-diff.json
- docs/generated/state-provider-seed-diff.md

## 9. Final commands

All final commands exited 0 under Node v24.12.0 with the expected Node 22.x engine warning:

| Command | Result |
|---|---|
| pnpm audit:providers | PASS. Raw 843, sanitized 842, coverage rows 1,767. |
| pnpm audit:providers:coverage | PASS. No coverage gaps found. |
| pnpm audit:providers:state-completeness | PASS. Catalog entries 105, newly added in merged seed 98, catalog-only backlog 7. |
| pnpm --filter @locateflow/db exec tsc --noEmit | PASS. |
| pnpm --filter @locateflow/web exec tsc --noEmit | PASS. |
| pnpm --filter @locateflow/admin exec tsc --noEmit | PASS. |
| pnpm --filter @locateflow/mobile exec tsc --noEmit | PASS. |

Controlled import confirmation: controlled-provider-import.ts and controlled-provider-import-data.ts remain absent.

No rejected resources were imported. No new providers outside the provided Batch 1 CSV were added by this Batch 1 work.
