# Provider Additions V1 Batch 3A Summary

Generated: 2026-05-07

## Scope

- Batch 3 planning rows reviewed: 98
- Batch 3A selected active rows: 5
- Batch 3A active rows added: 5
- Batch 3A skipped/deferred rows: 93
- No ADD_NEW_MANUAL_REVIEW, BACKLOG_ONLY, REJECT_RESOURCE_ONLY, or UPDATE_EXISTING_ONLY rows were implemented as new providers.
- No controlled-provider-import files were created.

## Selection Breakdown

- ADD_ACTIVE_IN_BATCH_3A: 5
- Existing/update/already-exists rows excluded: 61
- Manual-review rows excluded: 10
- Backlog-only rows excluded: 10
- Rejected/resource-only rows excluded: 12

## Selected State Breakdown

- CA: 1
- FL: 4

## Selected Category Breakdown

- UTILITY_TRASH: 2
- UTILITY_WATER: 3

## Selected Providers

- CA | recology-san-francisco | Recology San Francisco | UTILITY_TRASH | ZIP prefixes: 941
- FL | miami-dade-solid-waste | Miami-Dade Solid Waste Management | UTILITY_TRASH | ZIP prefixes: 330;331;332
- FL | orange-county-utilities-water | Orange County Utilities Water | UTILITY_WATER | ZIP prefixes: 327;328
- FL | palm-beach-county-water | Palm Beach County Water Utilities Department | UTILITY_WATER | ZIP prefixes: 334
- FL | pinellas-county-water | Pinellas County Utilities Water | UTILITY_WATER | ZIP prefixes: 337;346

## Deferred / Manual / Backlog Rows Not Imported

- AK | alaska-waste-ak | Alaska Waste | ADD_NEW_MANUAL_REVIEW
- AK | anchorage-solid-waste-services | Municipality of Anchorage Solid Waste Services | ADD_NEW_MANUAL_REVIEW
- AL | birmingham-waste-services | Birmingham Waste Services Division | BACKLOG_ONLY
- AL | huntsville-sanitation | City of Huntsville Garbage and Recycling | BACKLOG_ONLY
- AL | mobile-sanitation | City of Mobile Sanitation / Public Services | BACKLOG_ONLY
- AL | montgomery-sanitation | City of Montgomery Sanitation Department | BACKLOG_ONLY
- AL | montgomery-water-works | Water Works and Sanitary Sewer Board of the City of Montgomery Water | BACKLOG_ONLY
- AL | montgomery-water-works-sewer | Water Works and Sanitary Sewer Board of the City of Montgomery Sewer | BACKLOG_ONLY
- AR | little-rock-solid-waste | Little Rock Solid Waste Services | BACKLOG_ONLY
- AR | north-little-rock-sanitation | North Little Rock Sanitation | BACKLOG_ONLY
- CA | san-diego-environmental-services | City of San Diego Environmental Services | BACKLOG_ONLY
- CT | connecticut-water-company | Connecticut Water Company | ADD_NEW_MANUAL_REVIEW
- DC | dc-dpw-trash-collection | DC Department of Public Works Trash Collection | ADD_NEW_MANUAL_REVIEW
- DE | kent-county-trash-recycling | Kent County Trash and Recycling Pickup | ADD_NEW_MANUAL_REVIEW
- FL | broward-county-solid-waste-recycling | Broward County Solid Waste and Recycling Services | ADD_NEW_MANUAL_REVIEW
- FL | city-of-miami-solid-waste | City of Miami Solid Waste | ADD_NEW_MANUAL_REVIEW
- FL | city-of-orlando-solid-waste | City of Orlando Solid Waste | BACKLOG_ONLY
- FL | jacksonville-solid-waste | Jacksonville Solid Waste | ADD_NEW_MANUAL_REVIEW
- FL | orange-county-solid-waste | Orange County Solid Waste | ADD_NEW_MANUAL_REVIEW
- FL | palm-beach-county-solid-waste-authority | Solid Waste Authority of Palm Beach County | ADD_NEW_MANUAL_REVIEW

## Rejected Resources Not Imported

- AK | fairbanks-north-star-solid-waste | Fairbanks North Star Borough Solid Waste Division
- AK | juneau-curbside-pickup | City and Borough of Juneau Curbside Pickup Resource
- CA | san-jose-recycling-garbage | San Jose Recycling and Garbage Services
- CO | fort-collins-trash-recycling | Fort Collins Residential Trash and Recycling
- CT | bridgeport-sanitation-recycling | Bridgeport Sanitation and Recycling
- CT | hartford-dpw-waste-recycling | Hartford Department of Public Works Waste & Recycling
- CT | new-haven-public-works-trash-recycling | New Haven Public Works Trash & Recycling
- CT | stamford-recycling-sanitation | Stamford Recycling and Sanitation
- CT | waterbury-bureau-refuse | Waterbury Bureau of Refuse
- DC | dc-dpw-bulk-trash | DPW Bulk Trash Collection
- DC | dc-dpw-collection-day-app | DPW Collection Day App
- DC | zero-waste-dc-recycling | Zero Waste DC Residential Recycling

## Coverage Notes

- Every selected Batch 3A row uses ZIP-prefix coverage.
- Every selected Batch 3A row is address-check-required.
- No selected row uses statewide coverage.
- No selected row is TRANSPORTATION_TRANSIT.
- Selected ZIP-prefix coverage rows added: 9.

## Recommendation

Safe to implement as Batch 3A only. Keep all non-selected Batch 3 rows out of active seed output until a separate manual review or later batch.
