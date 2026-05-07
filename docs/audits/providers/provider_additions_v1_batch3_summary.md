# Provider Additions V1 Batch 3 Planning Summary

Generated: 2026-05-07

## Scope

- Planning only: no seed files edited, no generated docs edited, no DB changes, no providers added.
- Baseline: current repo state after Batch 2A confirmation.
- Confirmed staging baseline supplied by requester: ServiceProvider count 883, active provider count 883, ServiceProviderCoverage count 1823.
- Controlled provider import files must remain absent: packages/db/prisma/seed-data/controlled-provider-import.ts and packages/db/prisma/seed-data/controlled-provider-import-data.ts.
- Rows reviewed: 98
- Source reviewed: docs/audits/providers/provider_additions_v1_batch2a_codex_review.csv, limited to rows not selected into Batch 2A.

## Missing Requested Input Files

The following requested original V1 CSV names were not present in docs/audits/providers and were not found by repo-wide rg --files search excluding .git, .claude, and node_modules:

- docs/audits/providers/provider_additions_v1_candidates.csv
- docs/audits/providers/provider_additions_v1_rejected_resources.csv
- docs/audits/providers/provider_additions_v1_existing_updates.csv

The Batch 2 summary references these source files, but the referenced paths are also absent from the current working tree:

- New folder/locateflow_provider_additions_v1_candidates(1).csv
- New folder/locateflow_provider_additions_v1_rejected_resources(1).csv
- New folder/locateflow_provider_additions_v1_existing_updates.csv

## Decision Counts

- ADD_NEW_ACTIVE count: 5
- ADD_NEW_MANUAL_REVIEW count: 10
- UPDATE_EXISTING_ONLY count: 61
- SKIP_ALREADY_EXISTS count: 0
- REJECT_RESOURCE_ONLY count: 12
- BACKLOG_ONLY count: 10

## Category Breakdown

| category | rows |
| --- | --- |
| UTILITY_SEWER | 37 |
| UTILITY_TRASH | 47 |
| UTILITY_WATER | 14 |

## State Breakdown

| state | rows |
| --- | --- |
| AK | 8 |
| AL | 10 |
| AR | 10 |
| AZ | 11 |
| CA | 11 |
| CO | 5 |
| CT | 7 |
| DC | 6 |
| DE | 14 |
| FL | 16 |

## High-Risk Candidates

- AK | alaska-waste-ak | Alaska Waste | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- AK | anchorage-solid-waste-services | Municipality of Anchorage Solid Waste Services | ADD_NEW_MANUAL_REVIEW | live_address | Municipal solid-waste service appears plausible, but the available artifact URL is broad and same-domain transit exists; verify customer account/billing/service-address actions before active import.
- AL | birmingham-waste-services | Birmingham Waste Services Division | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | huntsville-sanitation | City of Huntsville Garbage and Recycling | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | mobile-sanitation | City of Mobile Sanitation / Public Services | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | montgomery-sanitation | City of Montgomery Sanitation Department | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AR | little-rock-solid-waste | Little Rock Solid Waste Services | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AR | north-little-rock-sanitation | North Little Rock Sanitation | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- CA | san-diego-environmental-services | City of San Diego Environmental Services | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- CT | connecticut-water-company | Connecticut Water Company | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- DC | dc-dpw-trash-collection | DC Department of Public Works Trash Collection | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- DE | kent-county-trash-recycling | Kent County Trash and Recycling Pickup | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- FL | broward-county-solid-waste-recycling | Broward County Solid Waste and Recycling Services | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- FL | city-of-miami-solid-waste | City of Miami Solid Waste | ADD_NEW_MANUAL_REVIEW | live_address | City solid-waste collection appears plausible, but the available artifact URL is broad and does not confirm a customer account/billing/start-stop action.
- FL | city-of-orlando-solid-waste | City of Orlando Solid Waste | BACKLOG_ONLY | manual_backlog | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- FL | jacksonville-solid-waste | Jacksonville Solid Waste | ADD_NEW_MANUAL_REVIEW | live_address | Jacksonville solid-waste service appears address-based, but the available artifacts do not confirm a customer account or start/stop/billing surface.
- FL | orange-county-solid-waste | Orange County Solid Waste | ADD_NEW_MANUAL_REVIEW | live_address | Orange County solid-waste service may be real, but the available artifacts do not confirm customer account coverage or distinguish it from resource/drop-off information.
- FL | palm-beach-county-solid-waste-authority | Solid Waste Authority of Palm Beach County | ADD_NEW_MANUAL_REVIEW | live_address | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.

## Trash / Sanitation Candidates Rejected And Why

- AK | fairbanks-north-star-solid-waste | Fairbanks North Star Borough Solid Waste Division | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- AK | juneau-curbside-pickup | City and Borough of Juneau Curbside Pickup Resource | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- CA | san-jose-recycling-garbage | San Jose Recycling and Garbage Services | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- CO | fort-collins-trash-recycling | Fort Collins Residential Trash and Recycling | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- CT | bridgeport-sanitation-recycling | Bridgeport Sanitation and Recycling | City sanitation/recycling information page in available artifacts; no confirmed customer account, billing, start/stop, transfer, or service-address action.
- CT | hartford-dpw-waste-recycling | Hartford Department of Public Works Waste & Recycling | Department of Public Works waste/recycling information surface; no confirmed customer account, billing, start/stop, transfer, or service-address action.
- CT | new-haven-public-works-trash-recycling | New Haven Public Works Trash & Recycling | Public Works trash/recycling information surface; no confirmed customer account, billing, start/stop, transfer, or service-address action.
- CT | stamford-recycling-sanitation | Stamford Recycling and Sanitation | Recycling and sanitation about/resource surface; no confirmed customer account, billing, start/stop, transfer, or service-address action.
- CT | waterbury-bureau-refuse | Waterbury Bureau of Refuse | Bureau of Refuse/public-works information surface; no confirmed customer account, billing, start/stop, transfer, or service-address action.
- DC | dc-dpw-bulk-trash | DPW Bulk Trash Collection | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- DC | dc-dpw-collection-day-app | DPW Collection Day App | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.
- DC | zero-waste-dc-recycling | Zero Waste DC Residential Recycling | Rejected under Batch 3 strict trash/sanitation rules: available artifacts indicate public-works, pickup, recycling, collection-day, education, or resource information rather than a confirmed customer account/start-stop/billing provider.

## Safe Candidates For Batch 3A

- CA | recology-san-francisco | Recology San Francisco | UTILITY_TRASH | ZIP prefixes: 941
- FL | miami-dade-solid-waste | Miami-Dade Solid Waste Management | UTILITY_TRASH | ZIP prefixes: 330;331;332
- FL | orange-county-utilities-water | Orange County Utilities Water | UTILITY_WATER | ZIP prefixes: 327;328
- FL | palm-beach-county-water | Palm Beach County Water Utilities Department | UTILITY_WATER | ZIP prefixes: 334
- FL | pinellas-county-water | Pinellas County Utilities Water | UTILITY_WATER | ZIP prefixes: 337;346

## Candidates That Must Stay Manual / Backlog

- AK | alaska-waste-ak | Alaska Waste | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- AK | anchorage-solid-waste-services | Municipality of Anchorage Solid Waste Services | ADD_NEW_MANUAL_REVIEW | Municipal solid-waste service appears plausible, but the available artifact URL is broad and same-domain transit exists; verify customer account/billing/service-address actions before active import.
- AL | birmingham-waste-services | Birmingham Waste Services Division | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | huntsville-sanitation | City of Huntsville Garbage and Recycling | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | mobile-sanitation | City of Mobile Sanitation / Public Services | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | montgomery-sanitation | City of Montgomery Sanitation Department | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AL | montgomery-water-works | Water Works and Sanitary Sewer Board of the City of Montgomery Water | BACKLOG_ONLY | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- AL | montgomery-water-works-sewer | Water Works and Sanitary Sewer Board of the City of Montgomery Sewer | BACKLOG_ONLY | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- AR | little-rock-solid-waste | Little Rock Solid Waste Services | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- AR | north-little-rock-sanitation | North Little Rock Sanitation | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- CA | san-diego-environmental-services | City of San Diego Environmental Services | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- CT | connecticut-water-company | Connecticut Water Company | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- DC | dc-dpw-trash-collection | DC Department of Public Works Trash Collection | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- DE | kent-county-trash-recycling | Kent County Trash and Recycling Pickup | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- FL | broward-county-solid-waste-recycling | Broward County Solid Waste and Recycling Services | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.
- FL | city-of-miami-solid-waste | City of Miami Solid Waste | ADD_NEW_MANUAL_REVIEW | City solid-waste collection appears plausible, but the available artifact URL is broad and does not confirm a customer account/billing/start-stop action.
- FL | city-of-orlando-solid-waste | City of Orlando Solid Waste | BACKLOG_ONLY | Trash/sanitation surface may represent municipal collection, but the available artifacts do not confirm a real customer account, billing, start/stop, transfer, or service-address action. Hold for manual source review.
- FL | jacksonville-solid-waste | Jacksonville Solid Waste | ADD_NEW_MANUAL_REVIEW | Jacksonville solid-waste service appears address-based, but the available artifacts do not confirm a customer account or start/stop/billing surface.
- FL | orange-county-solid-waste | Orange County Solid Waste | ADD_NEW_MANUAL_REVIEW | Orange County solid-waste service may be real, but the available artifacts do not confirm customer account coverage or distinguish it from resource/drop-off information.
- FL | palm-beach-county-solid-waste-authority | Solid Waste Authority of Palm Beach County | ADD_NEW_MANUAL_REVIEW | Real provider or municipal collection surface is plausible, but the available artifacts do not confirm a bounded customer account/service-address action strongly enough for active Batch 3 import.

## Existing / Duplicate Avoidance Notes

- Same municipal utility account rows were folded into existing providers instead of adding duplicate category rows.
- Water/sewer duplicate rows continue to fold into the existing or planned customer-account provider for the same municipality or utility.
- Trash rows with only public works, calendar, recycling, route, or collection-info evidence were rejected or held.
- ZIP prefixes remain recommendation scoping only and are not proof of service. All active Batch 3A rows require address confirmation.

## Final Recommendation

Split into Batch 3A-3B. Batch 3A can be a small implementation containing only the 5 ADD_NEW_ACTIVE rows listed above. Batch 3B should be manual review for trash/sanitation and unclear-territory utility rows before any additional active import. Do not import rejected resources, backlog-only rows, or duplicate same-account rows.
