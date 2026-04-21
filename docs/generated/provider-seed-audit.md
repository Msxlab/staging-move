# Provider Seed Audit Report

Generated: 2026-04-18T17:23:41.364Z

## Summary

- Raw provider records: 700
- Sanitized provider records: 700
- Dedupe removals: 0
- Cross-category slug renames: 0
- Same-category normalized-name duplicates: 0
- Cross-category normalized-name duplicates: 0
- Cross-category domain duplicates: 30

## Scope Distribution

- STATE: 427
- FEDERAL: 273

## Coverage Shape

- Exact ZIP rules: 0
- ZIP prefix rules: 280
- State-wide rows: 575
- Providers with no generated coverage rows: 273

## Top Categories

- UTILITY_ELECTRIC (Electric): 71
- UTILITY_WATER (Water): 67
- TRANSPORTATION_TRANSIT (Transit): 66
- UTILITY_GAS (Gas): 56
- GOVERNMENT_VOTER (Voter Registration): 52
- GOVERNMENT_DMV (DMV): 51
- FINANCIAL_INSURANCE_HEALTH (Health Insurance): 44
- FINANCIAL_BANK (Banks): 18
- SHOPPING_RETAIL (Shopping): 18
- SHOPPING_SUBSCRIPTION (Subscriptions): 17
- UTILITY_INTERNET (Internet): 17
- UTILITY_PHONE (Phone): 15
- TRANSPORTATION_TOLL (Toll Pass): 14
- FINANCIAL_CREDIT_CARD (Credit Cards): 12
- HOUSING_MOVING (Moving): 9
- HOUSING_HOME_SERVICE (Home Services): 8
- HOUSING_SECURITY (Home Security): 8
- FINANCIAL_INSURANCE_AUTO (Auto Insurance): 7
- FITNESS_GYM (Fitness & Gym): 7
- GROCERY_DELIVERY (Grocery Delivery): 7

## Raw duplicate slugs

- None

## Same-category duplicate names

- None

## Cross-category duplicate names

- None

## Cross-category duplicate domains

- blackhillsenergy.com (medium)
  - Black Hills Energy SD | UTILITY_ELECTRIC | bhe-sd | blackhillsenergy.com
  - Black Hills Energy Colorado | UTILITY_GAS | bhe-co-gas | blackhillsenergy.com
  - Black Hills Energy Iowa | UTILITY_GAS | bhe-ia-gas | blackhillsenergy.com
  - Black Hills Energy Nebraska | UTILITY_GAS | bhe-ne-gas | blackhillsenergy.com
  - Source Gas Distribution Wyoming | UTILITY_GAS | source-gas-wy | blackhillsenergy.com
- costco.com (high)
  - Costco | SHOPPING_SUBSCRIPTION | costco | costco.com
  - Costco Pharmacy | HEALTHCARE_PHARMACY | costco-pharmacy | costco.com
  - Costco Optical | HEALTHCARE_PHARMACY | costco-optical | costco.com
- dominionenergy.com (medium)
  - Dominion Energy | UTILITY_ELECTRIC | dominion | dominionenergy.com
  - Dominion Energy South Carolina Gas | UTILITY_GAS | dominion-sc-gas | dominionenergy.com
  - Dominion Energy Utah | UTILITY_GAS | dominion-ut-gas | dominionenergy.com
- montana-dakota.com (medium)
  - MDU Resources | UTILITY_ELECTRIC | mdu-nd | montana-dakota.com
  - MDU Resources South Dakota Gas | UTILITY_GAS | mdu-sd-gas | montana-dakota.com
  - Montana-Dakota Utilities | UTILITY_GAS | mdu | montana-dakota.com
- progressive.com (medium)
  - Progressive | FINANCIAL_INSURANCE_AUTO | progressive | progressive.com
  - Progressive Motorcycle | FINANCIAL_INSURANCE_MOTORCYCLE | progressive-motorcycle | progressive.com
  - Progressive Boat Insurance | FINANCIAL_INSURANCE_BOAT | progressive-boat | progressive.com
- spectrum.com (medium)
  - Spectrum Mobile | UTILITY_PHONE | spectrum-mobile | spectrum.com
  - Spectrum | UTILITY_INTERNET | spectrum | spectrum.com
  - Spectrum Maine | UTILITY_INTERNET | spectrum-me | spectrum.com
- xcelenergy.com (medium)
  - Xcel Energy | UTILITY_ELECTRIC | xcel-energy | xcelenergy.com
  - Xcel Energy ND | UTILITY_ELECTRIC | xcel-nd | xcelenergy.com
  - Xcel Energy North Dakota Gas | UTILITY_GAS | xcel-nd-gas | xcelenergy.com
- amazon.com (high)
  - Amazon Prime | SHOPPING_SUBSCRIPTION | amazon-prime | amazon.com
  - Amazon Fresh | GROCERY_DELIVERY | amazon-fresh | amazon.com
- att.com (medium)
  - AT&T | UTILITY_PHONE | att | att.com
  - AT&T Fiber | UTILITY_INTERNET | att-fiber | att.com
- bankofamerica.com (medium)
  - Bank of America | FINANCIAL_BANK | bank-of-america | bankofamerica.com
  - Bank of America Credit Cards | FINANCIAL_CREDIT_CARD | boa-cards | bankofamerica.com
- capitalone.com (medium)
  - Capital One | FINANCIAL_BANK | capital-one | capitalone.com
  - Capital One Credit Cards | FINANCIAL_CREDIT_CARD | capital-one-cards | capitalone.com
- chewy.com (high)
  - Chewy | SHOPPING_SUBSCRIPTION | chewy | chewy.com
  - Chewy Connect with a Vet | HEALTHCARE_VET | chewy-vet | chewy.com
- citi.com (medium)
  - Citibank | FINANCIAL_BANK | citibank | citi.com
  - Citi Cards | FINANCIAL_CREDIT_CARD | citi-cards | citi.com
- cvs.com (medium)
  - CVS Pharmacy | HEALTHCARE_PHARMACY | cvs | cvs.com
  - MinuteClinic (CVS) | HEALTHCARE_DOCTORS | minuteclinic | cvs.com
- discover.com (medium)
  - Discover Bank | FINANCIAL_BANK | discover-bank | discover.com
  - Discover Card | FINANCIAL_CREDIT_CARD | discover-card | discover.com
- geico.com (medium)
  - GEICO | FINANCIAL_INSURANCE_AUTO | geico | geico.com
  - GEICO Motorcycle | FINANCIAL_INSURANCE_MOTORCYCLE | geico-motorcycle | geico.com
- maine.gov (medium)
  - Maine BMV | GOVERNMENT_DMV | dmv-me | maine.gov
  - Maine Secretary of State — Voter | GOVERNMENT_VOTER | vote-me | maine.gov
- miamidade.gov (high)
  - Miami-Dade Water & Sewer | UTILITY_WATER | miami-water | miamidade.gov
  - Miami-Dade Transit | TRANSPORTATION_TRANSIT | miami-transit | miamidade.gov
- nj.gov (medium)
  - New Jersey MVC | GOVERNMENT_DMV | dmv-nj | nj.gov
  - NJ Division of Taxation | GOVERNMENT_TAX | nj-tax | nj.gov
- oklahoma.gov (medium)
  - Oklahoma DPS | GOVERNMENT_DMV | dmv-ok | oklahoma.gov
  - Oklahoma State Election Board | GOVERNMENT_VOTER | vote-ok | oklahoma.gov

## Coverage Anomalies

- None

## Recommended Next Cleanup Slice

- Resolve cross-category same-name/domain duplicates first because they create recommendation ambiguity.
- Review all providers with STATE scope but no states/ZIP coverage.
- Review shared domains that span incompatible category families.
- Promote this report into CI as a failing guard once acceptable duplicate thresholds are defined.