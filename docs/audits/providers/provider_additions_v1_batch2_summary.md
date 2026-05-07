# Provider Additions V1 Batch 2 Planning Summary

Generated: 2026-05-07

## Inputs

- Source candidates: `New folder/locateflow_provider_additions_v1_candidates(1).csv`
- Source rejected resources: `New folder/locateflow_provider_additions_v1_rejected_resources(1).csv`
- Source existing updates: `New folder/locateflow_provider_additions_v1_existing_updates.csv`
- Batch reviewed: `BATCH_2_LOCAL_UTILITY_REVIEW`
- Current baseline: Batch 1 committed seed/provider catalog
- Controlled import files absent: yes

## Decision Counts

- rows reviewed: 138
- ADD_NEW_ACTIVE count: 77
- ADD_NEW_MANUAL_REVIEW count: 6
- UPDATE_EXISTING_ONLY count: 46
- SKIP_ALREADY_EXISTS count: 0
- REJECT_RESOURCE_ONLY count: 7
- BACKLOG_ONLY count: 2

## State Breakdown

| state | rows |
| --- | ---: |
| AK | 10 |
| AL | 15 |
| AR | 17 |
| AZ | 17 |
| CA | 17 |
| CO | 9 |
| CT | 12 |
| DC | 6 |
| DE | 18 |
| FL | 17 |

## Category Breakdown

| category | rows |
| --- | ---: |
| UTILITY_SEWER | 48 |
| UTILITY_TRASH | 47 |
| UTILITY_WATER | 43 |

## Coverage Model Breakdown

| coverageModel | rows |
| --- | ---: |
| existing_provider_update | 46 |
| live_address | 6 |
| manual_backlog | 2 |
| none | 7 |
| zip_prefix | 77 |

## Active Candidate State Breakdown

| state | ADD_NEW_ACTIVE |
| --- | ---: |
| AK | 3 |
| AL | 10 |
| AR | 11 |
| AZ | 11 |
| CA | 12 |
| CO | 4 |
| CT | 10 |
| DE | 5 |
| FL | 11 |

## High-Risk Coverage Candidates

- AK | alaska-waste-ak | Alaska Waste | ADD_NEW_MANUAL_REVIEW | live_address | Real regional hauler, but territory is unknown; keep hidden until service-area ZIPs or address-check behavior are confirmed.
- AL | montgomery-water-works-sewer | Water Works and Sanitary Sewer Board of the City of Montgomery Sewer | BACKLOG_ONLY | manual_backlog | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- AL | montgomery-water-works | Water Works and Sanitary Sewer Board of the City of Montgomery Water | BACKLOG_ONLY | manual_backlog | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- CT | connecticut-water-company | Connecticut Water Company | ADD_NEW_MANUAL_REVIEW | live_address | Real regulated water utility, but candidate territory is unknown; keep hidden until service towns/ZIPs are mapped.
- DC | dc-dpw-trash-collection | DC Department of Public Works Trash Collection | ADD_NEW_MANUAL_REVIEW | live_address | Real municipal collection surface, but eligibility depends on building size/private collection; manual review before public recommendation.
- DE | kent-county-trash-recycling | Kent County Trash and Recycling Pickup | ADD_NEW_MANUAL_REVIEW | live_address | County trash/recycling pickup is material, but not every county address is necessarily covered.
- FL | broward-county-solid-waste-recycling | Broward County Solid Waste and Recycling Services | ADD_NEW_MANUAL_REVIEW | live_address | County solid-waste surface is material, but source warns not to treat it as countywide curbside pickup.
- FL | palm-beach-county-solid-waste-authority | Solid Waste Authority of Palm Beach County | ADD_NEW_MANUAL_REVIEW | live_address | Real county solid-waste authority, but collection details may depend on municipality or hauler.

## Providers That Should NOT Be Imported As Active

- AK | alaska-waste-ak | Alaska Waste | ADD_NEW_MANUAL_REVIEW | Real regional hauler, but territory is unknown; keep hidden until service-area ZIPs or address-check behavior are confirmed.
- AK | juneau-curbside-pickup | City and Borough of Juneau Curbside Pickup Resource | REJECT_RESOURCE_ONLY | Curbside pickup resource/contractor guidance rather than a confirmed customer utility account provider.
- AK | fairbanks-north-star-solid-waste | Fairbanks North Star Borough Solid Waste Division | REJECT_RESOURCE_ONLY | Borough solid-waste information/drop-off surface; source notes it is not always curbside pickup or account service.
- AL | montgomery-water-works-sewer | Water Works and Sanitary Sewer Board of the City of Montgomery Sewer | BACKLOG_ONLY | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- AL | montgomery-water-works | Water Works and Sanitary Sewer Board of the City of Montgomery Water | BACKLOG_ONLY | Official public site was not confirmed in the candidate CSV; hold until a reliable board/customer account URL is verified.
- CA | san-jose-recycling-garbage | San Jose Recycling and Garbage Services | REJECT_RESOURCE_ONLY | Resource row before hauler-specific mapping; not a confirmed customer account provider.
- CO | fort-collins-trash-recycling | Fort Collins Residential Trash and Recycling | REJECT_RESOURCE_ONLY | City recycling/contract guidance; collection depends on private hauler/property details rather than a city utility account.
- CT | connecticut-water-company | Connecticut Water Company | ADD_NEW_MANUAL_REVIEW | Real regulated water utility, but candidate territory is unknown; keep hidden until service towns/ZIPs are mapped.
- DC | dc-dpw-trash-collection | DC Department of Public Works Trash Collection | ADD_NEW_MANUAL_REVIEW | Real municipal collection surface, but eligibility depends on building size/private collection; manual review before public recommendation.
- DC | dc-dpw-bulk-trash | DPW Bulk Trash Collection | REJECT_RESOURCE_ONLY | Bulk-trash request/resource page, not a normal recurring provider account for move tracking.
- DC | dc-dpw-collection-day-app | DPW Collection Day App | REJECT_RESOURCE_ONLY | Collection-day lookup app/resource, not a provider account or start/stop service surface.
- DC | zero-waste-dc-recycling | Zero Waste DC Residential Recycling | REJECT_RESOURCE_ONLY | Educational recycling resource; larger buildings require private collection.
- DE | kent-county-trash-recycling | Kent County Trash and Recycling Pickup | ADD_NEW_MANUAL_REVIEW | County trash/recycling pickup is material, but not every county address is necessarily covered.
- FL | broward-county-solid-waste-recycling | Broward County Solid Waste and Recycling Services | ADD_NEW_MANUAL_REVIEW | County solid-waste surface is material, but source warns not to treat it as countywide curbside pickup.
- FL | palm-beach-county-solid-waste-authority | Solid Waste Authority of Palm Beach County | ADD_NEW_MANUAL_REVIEW | Real county solid-waste authority, but collection details may depend on municipality or hauler.

## Existing / Duplicate Avoidance

- AK | juneau-wastewater-utility -> juneau-water-utility | Same Juneau customer utility account as the planned water row; fold wastewater into one municipal account.
- AK | college-golden-heart-utilities-wastewater -> college-golden-heart-utilities-water | Same College & Golden Heart Utilities account as the planned water row; avoid duplicate water/sewer providers.
- AK | ketchikan-public-utilities-wastewater -> ketchikan-public-utilities-electric | Same Ketchikan Public Utilities account/domain as the existing Batch 1 electric row.
- AK | ketchikan-public-utilities-water -> ketchikan-public-utilities-electric | Same Ketchikan Public Utilities account/domain as the existing Batch 1 electric row.
- AL | tuscaloosa-sewer -> tuscaloosa-water | Same City of Tuscaloosa utility account as the planned water row; avoid duplicate water/sewer providers.
- AL | mawss-sewer -> mawss-water | Same MAWSS account as the planned water row; avoid duplicate water/sewer providers.
- AL | huntsville-utilities-water -> huntsville-utilities-electric | Same Huntsville Utilities account/domain as the existing Batch 1 electric row.
- AR | bentonville-wastewater-utilities -> bentonville-water-utilities | Same Bentonville utilities account as the planned water row; avoid duplicate water/sewer providers.
- AR | conway-corp-wastewater -> conway-corp-electric | Same Conway Corp multi-utility account/domain as the existing Batch 1 electric row.
- AR | fayetteville-sewer -> fayetteville-water | Same Fayetteville water/sewer account as the planned water row; avoid duplicate category rows.
- AR | fort-smith-sewer -> fort-smith-water | Same Fort Smith utilities account as the planned water row; avoid duplicate water/sewer providers.
- AR | rogers-sewer-utilities -> rogers-water-utilities | Same Rogers Water Utilities account as the planned water row; avoid duplicate water/sewer providers.
- AR | conway-corp-water -> conway-corp-electric | Same Conway Corp multi-utility account/domain as the existing Batch 1 electric row.
- AZ | chandler-wastewater -> chandler-water | Same Chandler municipal utility account as the planned water row; avoid duplicate water/sewer providers.
- AZ | tempe-wastewater -> tempe-water-services | Same Tempe water services account as the planned water row; avoid duplicate water/sewer providers.
- AZ | glendale-sewer -> glendale-water-services | Same Glendale Water Services account as the planned water row; avoid duplicate water/sewer providers.
- AZ | scottsdale-wastewater -> scottsdale-water | Same Scottsdale Water account as the planned water row; avoid duplicate water/sewer providers.
- AZ | gilbert-wastewater -> gilbert-water | Same Gilbert utility account as the planned water row; avoid duplicate water/sewer providers.
- AZ | mesa-trash-recycling -> mesa-utilities | Same City of Mesa utilities/customer-services surface as the existing Mesa Utilities provider.
- CA | fresno-wastewater -> fresno-water | Same Fresno Public Utilities account as the planned water row; avoid duplicate water/sewer providers.
- CA | sacramento-sewer -> sacramento-water | Same Sacramento utilities account as the planned water row; avoid duplicate water/sewer providers.
- CA | san-diego-public-utilities-wastewater -> san-diego-public-utilities-water | Same San Diego Public Utilities account as the planned water row; avoid duplicate water/sewer providers.
- CA | ebmud-wastewater -> ebmud-water | Same EBMUD customer account family as the planned water row; avoid duplicate water/sewer providers.
- CO | aurora-wastewater -> aurora-water | Same Aurora Water account as the planned water row; avoid duplicate water/sewer providers.
- CO | boulder-wastewater-utilities -> boulder-water-utilities | Same Boulder utilities account as the planned water row; avoid duplicate water/sewer providers.
- CO | colorado-springs-utilities-wastewater -> colorado-springs-utilities-water | Same Colorado Springs Utilities account as the planned water row; avoid duplicate water/sewer providers.
- CO | fort-collins-utilities-wastewater -> fort-collins-utilities-water | Same Fort Collins Utilities account as the planned water row; avoid duplicate water/sewer providers.
- CT | mdc-ct-sewer -> mdc-ct-water | Same Metropolitan District account as the planned water row; avoid duplicate water/sewer providers.
- DC | dc-water-sewer-support -> dc-water | Existing DC Water provider already covers water/sewer account support.
- DC | dc-water-start-stop -> dc-water | Existing DC Water provider already covers the customer account/start-stop surface.
- DE | city-of-dover-wastewater -> city-of-dover-electric | Same City of Dover utility customer-services surface as the existing Batch 1 electric row.
- DE | newark-de-wastewater -> city-of-newark-electric | Same City of Newark utility account/domain as the existing Batch 1 electric row.
- DE | lewes-bpw-wastewater -> lewes-bpw-electric | Same Lewes Board of Public Works customer account as the existing Batch 1 electric row.
- DE | town-of-middletown-wastewater -> town-of-middletown-electric | Same Middletown utilities customer account as the existing Batch 1 electric row.
- DE | wilmington-water-wastewater -> wilmington-water-utility | Same Wilmington Water Utility account as the planned water row; avoid duplicate water/sewer providers.
- DE | city-of-dover-sanitation -> city-of-dover-electric | Same City of Dover municipal utility/customer-services family; avoid a duplicate provider row.
- DE | newark-de-refuse-recycling -> city-of-newark-electric | Same City of Newark municipal services account/domain; avoid a duplicate provider row.
- DE | city-of-dover-water -> city-of-dover-electric | Same City of Dover utility customer-services surface as the existing Batch 1 electric row.
- DE | newark-de-water -> city-of-newark-electric | Same City of Newark utility account/domain as the existing Batch 1 electric row.
- DE | lewes-bpw-water -> lewes-bpw-electric | Same Lewes Board of Public Works customer account as the existing Batch 1 electric row.
- DE | new-castle-msc-water -> new-castle-msc-electric | Same New Castle MSC customer account as the existing Batch 1 electric row.
- DE | town-of-middletown-water -> town-of-middletown-electric | Same Middletown utilities customer account as the existing Batch 1 electric row.
- FL | hillsborough-county-wastewater -> hillsborough-county-water | Same Hillsborough County utility account as the planned water row; avoid duplicate water/sewer providers.
- FL | orange-county-utilities-wastewater -> orange-county-utilities-water | Same Orange County Utilities account as the planned water row; avoid duplicate water/sewer providers.
- FL | palm-beach-county-wastewater -> palm-beach-county-water | Same Palm Beach County Water Utilities account as the planned water row; avoid duplicate water/sewer providers.
- FL | pinellas-county-sewer -> pinellas-county-water | Same Pinellas County Utilities account as the planned water row; avoid duplicate water/sewer providers.

## Rejected Resources

- AK | juneau-curbside-pickup | City and Borough of Juneau Curbside Pickup Resource | Curbside pickup resource/contractor guidance rather than a confirmed customer utility account provider.
- AK | fairbanks-north-star-solid-waste | Fairbanks North Star Borough Solid Waste Division | Borough solid-waste information/drop-off surface; source notes it is not always curbside pickup or account service.
- CA | san-jose-recycling-garbage | San Jose Recycling and Garbage Services | Resource row before hauler-specific mapping; not a confirmed customer account provider.
- CO | fort-collins-trash-recycling | Fort Collins Residential Trash and Recycling | City recycling/contract guidance; collection depends on private hauler/property details rather than a city utility account.
- DC | dc-dpw-bulk-trash | DPW Bulk Trash Collection | Bulk-trash request/resource page, not a normal recurring provider account for move tracking.
- DC | dc-dpw-collection-day-app | DPW Collection Day App | Collection-day lookup app/resource, not a provider account or start/stop service surface.
- DC | zero-waste-dc-recycling | Zero Waste DC Residential Recycling | Educational recycling resource; larger buildings require private collection.

## Recommendation

Needs manual review before full Batch 2 implementation. The `ADD_NEW_ACTIVE` subset is scoped to real utility/provider account surfaces with ZIP or exact-ZIP context and address-check requirements, but manual-review/backlog/rejected rows must remain out of public recommendations and moving-task creation.
