# Provider Coverage Surface Inventory

Generated: 2026-06-12T16:43:35.069Z

## Summary

- Raw provider records: 1122
- Sanitized provider records: 1122
- Location-sensitive providers: 562
- Location-sensitive providers with ZIP rules: 434
- State-scoped overbroad candidates: 118
- Federal/address-qualified candidates: 39

## Category Precision

- TRANSPORTATION_TOLL (Toll Pass): total=38, federal=1, state=37, withZip=29, exactRows=289, prefixRows=127, stateRows=8
- TRANSPORTATION_TRANSIT (Transit): total=66, federal=0, state=66, withZip=41, exactRows=0, prefixRows=157, stateRows=27
- UTILITY_ELECTRIC (Electric): total=199, federal=0, state=199, withZip=177, exactRows=1077, prefixRows=738, stateRows=37
- UTILITY_GAS (Gas): total=83, federal=0, state=83, withZip=57, exactRows=411, prefixRows=475, stateRows=32
- UTILITY_INTERNET (Internet): total=20, federal=9, state=11, withZip=0, exactRows=0, prefixRows=0, stateRows=88
- UTILITY_WATER (Water): total=156, federal=0, state=156, withZip=130, exactRows=1040, prefixRows=304, stateRows=26

## Highest-Risk States

- CA: highRiskLocalProviders=6, locationSensitiveProviders=38
- TX: highRiskLocalProviders=4, locationSensitiveProviders=35
- PA: highRiskLocalProviders=3, locationSensitiveProviders=33
- LA: highRiskLocalProviders=3, locationSensitiveProviders=18
- FL: highRiskLocalProviders=2, locationSensitiveProviders=38
- VA: highRiskLocalProviders=2, locationSensitiveProviders=33
- NC: highRiskLocalProviders=2, locationSensitiveProviders=32
- NY: highRiskLocalProviders=2, locationSensitiveProviders=25
- DE: highRiskLocalProviders=2, locationSensitiveProviders=24
- IL: highRiskLocalProviders=2, locationSensitiveProviders=23
- AL: highRiskLocalProviders=2, locationSensitiveProviders=22
- KS: highRiskLocalProviders=2, locationSensitiveProviders=20
- SD: highRiskLocalProviders=2, locationSensitiveProviders=19
- OK: highRiskLocalProviders=2, locationSensitiveProviders=18
- WY: highRiskLocalProviders=2, locationSensitiveProviders=18
- IN: highRiskLocalProviders=2, locationSensitiveProviders=17
- ND: highRiskLocalProviders=2, locationSensitiveProviders=16
- RI: highRiskLocalProviders=2, locationSensitiveProviders=15
- CO: highRiskLocalProviders=1, locationSensitiveProviders=30
- NV: highRiskLocalProviders=1, locationSensitiveProviders=30

## State-Scoped Overbroad Candidates

- Alabama Freedom Pass | TRANSPORTATION_TOLL | AL | high | location-sensitive category has only state coverage | https://freedompass.americanroads.com
- E-ZPass Virginia | TRANSPORTATION_TOLL | VA | high | location-sensitive category has only state coverage | https://www.ezpassva.com/
- GeauxPass | TRANSPORTATION_TOLL | LA | high | location-sensitive category has only state coverage | https://www.geauxpass.com
- K-TAG | TRANSPORTATION_TOLL | KS | high | location-sensitive category has only state coverage | https://www.ksturnpike.com
- NJ E-ZPass | TRANSPORTATION_TOLL | NJ | high | location-sensitive category has only state coverage | https://www.ezpassnj.com
- NY E-ZPass | TRANSPORTATION_TOLL | NY | high | location-sensitive category has only state coverage | https://www.e-zpassny.com
- SunPass | TRANSPORTATION_TOLL | FL | high | location-sensitive category has only state coverage | https://www.sunpass.com/
- TxTag | TRANSPORTATION_TOLL | TX | high | location-sensitive category has only state coverage | https://www.txtag.org
- BART | TRANSPORTATION_TRANSIT | CA | high | locality signal in name/description with state-only coverage | https://www.bart.gov
- Caltrain | TRANSPORTATION_TRANSIT | CA | high | location-sensitive category has only state coverage | https://www.caltrain.com
- DART | TRANSPORTATION_TRANSIT | TX | high | locality signal in name/description with state-only coverage | https://www.dart.org
- DART First State | TRANSPORTATION_TRANSIT | DE | high | location-sensitive category has only state coverage | https://dartfirststate.com
- GoRaleigh | TRANSPORTATION_TRANSIT | NC | high | locality signal in name/description with state-only coverage | https://goraleigh.org
- GoTriangle | TRANSPORTATION_TRANSIT | NC | high | locality signal in name/description with state-only coverage | https://gotriangle.org
- Houston METRO | TRANSPORTATION_TRANSIT | TX | high | locality signal in name/description with state-only coverage | https://www.ridemetro.org
- IndyGo | TRANSPORTATION_TRANSIT | IN | high | locality signal in name/description with state-only coverage | https://www.indygo.net
- LA Metro | TRANSPORTATION_TRANSIT | CA | high | locality signal in name/description with state-only coverage | https://www.metro.net
- Lynx | TRANSPORTATION_TRANSIT | FL | high | locality signal in name/description with state-only coverage | https://www.golynx.com
- Metra | TRANSPORTATION_TRANSIT | IL | high | location-sensitive category has only state coverage | https://www.metrarail.com
- MTA | TRANSPORTATION_TRANSIT | NY | high | locality signal in name/description with state-only coverage | https://www.mta.info
- New Orleans Regional Transit Authority | TRANSPORTATION_TRANSIT | LA | high | locality signal in name/description with state-only coverage | https://www.norta.com
- RIPTA | TRANSPORTATION_TRANSIT | RI | high | locality signal in name/description with state-only coverage | https://ripta.com
- RTA Cleveland | TRANSPORTATION_TRANSIT | OH | high | locality signal in name/description with state-only coverage | https://www.riderta.com
- RTC Southern Nevada | TRANSPORTATION_TRANSIT | NV | high | locality signal in name/description with state-only coverage | https://www.rtcsnv.com
- RTD | TRANSPORTATION_TRANSIT | CO | high | locality signal in name/description with state-only coverage | https://www.rtd-denver.com
- San Diego MTS | TRANSPORTATION_TRANSIT | CA | high | location-sensitive category has only state coverage | https://www.sdmts.com
- SF Muni | TRANSPORTATION_TRANSIT | CA | high | location-sensitive category has only state coverage | https://www.sfmta.com
- TheBus | TRANSPORTATION_TRANSIT | HI | high | locality signal in name/description with state-only coverage | https://www.thebus.org
- UTA | TRANSPORTATION_TRANSIT | UT | high | locality signal in name/description with state-only coverage | https://www.rideuta.com
- VIA Metropolitan Transit | TRANSPORTATION_TRANSIT | TX | high | locality signal in name/description with state-only coverage | https://www.viainfo.net
- VTA | TRANSPORTATION_TRANSIT | CA | high | locality signal in name/description with state-only coverage | https://www.vta.org
- WeGo Public Transit | TRANSPORTATION_TRANSIT | TN | high | locality signal in name/description with state-only coverage | https://www.wegotransit.com
- WMATA (Metro) | TRANSPORTATION_TRANSIT | VA,DC,MD | high | locality signal in name/description with state-only coverage | https://www.wmata.com
- Alliant Energy | UTILITY_ELECTRIC | IA,WI | high | locality signal in name/description with state-only coverage | https://www.alliantenergy.com
- Ameren Illinois | UTILITY_ELECTRIC | IL | high | locality signal in name/description with state-only coverage | https://www.ameren.com/illinois
- Appalachian Power | UTILITY_ELECTRIC | WV,VA | medium | location-sensitive category has only state coverage | https://www.appalachianpower.com/account/service/start-stop-transfer
- Black Hills Energy SD | UTILITY_ELECTRIC | SD,WY,NE,IA,KS | medium | location-sensitive category has only state coverage | https://www.blackhillsenergy.com
- Central Maine Power | UTILITY_ELECTRIC | ME | high | locality signal in name/description with state-only coverage | https://www.cmpco.com
- Chugach Electric | UTILITY_ELECTRIC | AK | high | locality signal in name/description with state-only coverage | https://www.chugachelectric.com
- Evergy | UTILITY_ELECTRIC | KS,MO | medium | location-sensitive category has only state coverage | https://www.evergy.com
- Florida Power & Light Company | UTILITY_ELECTRIC | FL | medium | location-sensitive category has only state coverage | https://www.fpl.com/landing/service-order.html
- Green Mountain Power | UTILITY_ELECTRIC | VT | high | locality signal in name/description with state-only coverage | https://www.greenmountainpower.com
- Idaho Power | UTILITY_ELECTRIC | ID | high | locality signal in name/description with state-only coverage | https://www.idahopower.com
- Kentucky Utilities | UTILITY_ELECTRIC | KY | high | locality signal in name/description with state-only coverage | https://www.lge-ku.com
- MDU Resources | UTILITY_ELECTRIC | ND,MT,SD,WY | medium | location-sensitive category has only state coverage | https://www.montana-dakota.com
- MidAmerican Energy | UTILITY_ELECTRIC | IA | medium | location-sensitive category has only state coverage | https://www.midamericanenergy.com
- Mon Power | UTILITY_ELECTRIC | WV | medium | location-sensitive category has only state coverage | https://www.firstenergycorp.com/monpower
- Nashville Electric Service | UTILITY_ELECTRIC | TN | medium | location-sensitive category has only state coverage | https://www.nespower.com
- OG&E | UTILITY_ELECTRIC | OK | high | locality signal in name/description with state-only coverage | https://www.oge.com/web/portal/label_ord/residential/startstoptransfer/overview
- PNM | UTILITY_ELECTRIC | NM | medium | location-sensitive category has only state coverage | https://www.pnm.com
- Public Service Oklahoma (PSO) | UTILITY_ELECTRIC | OK | high | locality signal in name/description with state-only coverage | https://www.psoklahoma.com
- Reliant Energy | UTILITY_ELECTRIC | TX | medium | location-sensitive category has only state coverage | https://www.reliant.com
- Rocky Mountain Power | UTILITY_ELECTRIC | UT,WY,ID | medium | location-sensitive category has only state coverage | https://www.rockymountainpower.net/my-account/start-stop-move.html
- Versant Power | UTILITY_ELECTRIC | ME | high | locality signal in name/description with state-only coverage | https://www.versantpower.com
- Xcel Energy ND | UTILITY_ELECTRIC | ND,MN,WI,SD | high | locality signal in name/description with state-only coverage | https://www.xcelenergy.com
- Atmos Energy Kentucky | UTILITY_GAS | KY | medium | location-sensitive category has only state coverage | https://www.atmosenergy.com
- Atmos Energy Louisiana | UTILITY_GAS | LA | high | locality signal in name/description with state-only coverage | https://www.atmosenergy.com
- Atmos Energy Mississippi | UTILITY_GAS | MS | high | locality signal in name/description with state-only coverage | https://www.atmosenergy.com
- Black Hills Energy Iowa | UTILITY_GAS | IA | high | locality signal in name/description with state-only coverage | https://www.blackhillsenergy.com
- Black Hills Energy Nebraska | UTILITY_GAS | NE | high | locality signal in name/description with state-only coverage | https://www.blackhillsenergy.com
- CenterPoint Energy | UTILITY_GAS | TX | medium | location-sensitive category has only state coverage | https://www.centerpointenergy.com
- CenterPoint Energy Minnesota | UTILITY_GAS | MN | high | locality signal in name/description with state-only coverage | https://www.centerpointenergy.com/minnesota
- Citizens Energy Group | UTILITY_GAS | IN | high | locality signal in name/description with state-only coverage | https://www.citizensenergygroup.com
- Enbridge Gas Utah | UTILITY_GAS | UT,WY,ID | medium | location-sensitive category has only state coverage | https://www.enbridgegas.com/utwyid/start-stop-service
- ENSTAR Natural Gas | UTILITY_GAS | AK | high | locality signal in name/description with state-only coverage | https://www.enstarnaturalgas.com
- Hawaii Gas | UTILITY_GAS | HI | high | locality signal in name/description with state-only coverage | https://www.hawaiigas.com/contact-us
- Intermountain Gas | UTILITY_GAS | ID | high | locality signal in name/description with state-only coverage | https://www.intgas.com
- Kansas Gas Service | UTILITY_GAS | KS | high | locality signal in name/description with state-only coverage | https://www.kansasgasservice.com
- MDU Resources South Dakota Gas | UTILITY_GAS | SD | high | locality signal in name/description with state-only coverage | https://www.montana-dakota.com
- Minnesota Energy Resources | UTILITY_GAS | MN | high | locality signal in name/description with state-only coverage | https://www.minnesotaenergyresources.com
- Montana-Dakota Utilities | UTILITY_GAS | ND,SD,WY | high | locality signal in name/description with state-only coverage | https://www.montana-dakota.com
- Mountaineer Gas | UTILITY_GAS | WV | high | locality signal in name/description with state-only coverage | https://www.mountaineergas.com
- NJ Natural Gas | UTILITY_GAS | NJ | medium | location-sensitive category has only state coverage | https://www.njng.com
- NorthWestern Energy | UTILITY_GAS | MT,SD,NE | high | locality signal in name/description with state-only coverage | https://www.northwesternenergy.com
- Oklahoma Natural Gas (ONE Gas) | UTILITY_GAS | OK | high | locality signal in name/description with state-only coverage | https://www.oklahomanaturalgas.com
- Piedmont Natural Gas Tennessee | UTILITY_GAS | TN | high | locality signal in name/description with state-only coverage | https://www.piedmontng.com/home/start-stop-or-move
- Source Gas Distribution Wyoming | UTILITY_GAS | WY | high | locality signal in name/description with state-only coverage | https://www.blackhillsenergy.com
- Spire Missouri | UTILITY_GAS | MO | high | locality signal in name/description with state-only coverage | https://www.spireenergy.com
- Summit Natural Gas of Maine | UTILITY_GAS | ME | high | locality signal in name/description with state-only coverage | https://www.summitnaturalgas.com
- UGI Utilities | UTILITY_GAS | PA | high | locality signal in name/description with state-only coverage | https://www.ugi.com/start-stop-transfer-service/

## Federal Address-Qualified Candidates

- Amazon Fresh | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.amazon.com/fresh
- Blue Apron | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.blueapron.com
- DoorDash | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.doordash.com
- HelloFresh | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.hellofresh.com
- Instacart | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.instacart.com
- Shipt | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.shipt.com
- Walmart+ Delivery | GROCERY_DELIVERY | medium | national brand likely requires address-level serviceability check | https://www.walmart.com/plus
- Ace Hardware | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.acehardware.com
- Angi (Angie's List) | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.angi.com
- Home Depot | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.homedepot.com
- HomeAdvisor | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.homeadvisor.com
- Lowe's | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.lowes.com
- Mr. Handyman | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.mrhandyman.com
- Ring | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.ring.com
- Roto-Rooter | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.rotorooter.com
- ServPro | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.servpro.com
- TaskRabbit | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.taskrabbit.com
- Thumbtack | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.thumbtack.com
- True Value | HOUSING_HOME_SERVICE | medium | national brand likely requires address-level serviceability check | https://www.truevalue.com
- 1-800-GOT-JUNK | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.1800gotjunk.com
- Allied Van Lines | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.allied.com
- Budget Truck Rental | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.budgettruck.com
- Mayflower Moving | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.mayflower.com
- Penske Truck Rental | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.pensketruckrental.com
- PODS | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.pods.com
- Two Men and a Truck | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.twomenandatruck.com
- U-Haul | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.uhaul.com
- United Van Lines | HOUSING_MOVING | medium | national brand likely requires address-level serviceability check | https://www.unitedvanlines.com
- Astound Broadband | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.astound.com
- AT&T Fiber | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.att.com/internet/fiber
- Spectrum | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.spectrum.com
- Starlink | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.starlink.com
- T-Mobile Home Internet | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.t-mobile.com/home-internet
- Verizon 5G Home Internet | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.verizon.com/home/5g-home-internet
- Verizon Fios | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.verizon.com/fios
- WOW! Internet | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.wowway.com
- Xfinity (Comcast) | UTILITY_INTERNET | medium | national brand likely requires address-level serviceability check | https://www.xfinity.com
- Republic Services | UTILITY_TRASH | medium | national brand likely requires address-level serviceability check | https://www.republicservices.com
- Waste Management | UTILITY_TRASH | medium | national brand likely requires address-level serviceability check | https://www.wm.com

## Recommended Research Order

- UTILITY_WATER and TRANSPORTATION_TRANSIT first because they are most visibly overbroad at state level.
- UTILITY_ELECTRIC, UTILITY_GAS, and UTILITY_INTERNET second because they are location-sensitive but often span complex multistate territories.
- Federal brands with coverage checkers should be modeled separately from true nationwide providers.