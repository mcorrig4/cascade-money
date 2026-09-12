"""Embedded illustrative site pins and realistic regional supplier clusters.

Coordinates are approximate map pins, not surveyed factory boundaries. Corporate
site names follow the brief; synthetic firm locations use seeded cluster jitter.
"""
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class Site:
    site_id: str
    lat: float
    lon: float
    city: str
    country: str
    region: str


def site(key, lat, lon, city, country, region):
    return Site(key, lat, lon, city, country, region)


NAMED_SITES = {
    "Apple": [site("apple-park",37.3349,-122.0090,"Cupertino","United States","North America")],
    "Tesla": [site("tesla-fremont",37.4947,-121.9440,"Fremont","United States","North America"),site("tesla-austin",30.2223,-97.6171,"Austin","United States","North America")],
    "Foxconn": [site("foxconn-zhengzhou",34.535,113.850,"Zhengzhou","China","East Asia"),site("foxconn-chennai",12.973,79.946,"Chennai","India","South Asia")],
    "TSMC": [site("tsmc-hsinchu",24.773,121.012,"Hsinchu","Taiwan","East Asia")],
    "Samsung": [site("samsung-suwon",37.257,127.052,"Suwon","South Korea","East Asia")],
    "Samsung Display": [site("samsung-display-asan",36.797,127.059,"Asan","South Korea","East Asia")],
    "SK Hynix": [site("sk-hynix-icheon",37.253,127.487,"Icheon","South Korea","East Asia")],
    "LG": [site("lg-seoul",37.528,126.929,"Seoul","South Korea","East Asia")],
    "LG Energy": [site("lg-energy-seoul",37.526,126.929,"Seoul","South Korea","East Asia"),site("lg-energy-ochang",36.711,127.433,"Ochang","South Korea","East Asia")],
    "Sony": [site("sony-kumamoto",32.879,130.854,"Kumamoto","Japan","East Asia")],
    "Murata": [site("murata-kyoto",34.924,135.699,"Kyoto","Japan","East Asia")],
    "Panasonic": [site("panasonic-osaka",34.750,135.571,"Osaka","Japan","East Asia"),site("panasonic-wakayama",34.258,135.286,"Wakayama","Japan","East Asia")],
    "Corning": [site("corning-harrodsburg",37.772,-84.837,"Harrodsburg, Kentucky","United States","North America")],
    "Qualcomm": [site("qualcomm-san-diego",32.897,-117.195,"San Diego","United States","North America")],
    "Broadcom": [site("broadcom-palo-alto",37.404,-122.146,"Palo Alto","United States","North America")],
    "Pegatron": [site("pegatron-taipei",25.126,121.471,"Taipei","Taiwan","East Asia")],
    "Luxshare": [site("luxshare-kunshan",31.385,120.980,"Kunshan","China","East Asia")],
    "CATL": [site("catl-ningde",26.686,119.590,"Ningde","China","East Asia")],
    "Glencore": [site("glencore-baar",47.195,8.526,"Baar","Switzerland","Europe"),site("glencore-kolwezi",-10.716,25.473,"Kolwezi","Democratic Republic of the Congo","Africa"),site("glencore-sudbury",46.491,-80.993,"Sudbury","Canada","North America")],
    "Exxon": [site("exxon-baytown",29.746,-95.016,"Baytown, Texas","United States","North America")],
    "Shell": [site("shell-pernis",51.889,4.389,"Pernis","Netherlands","Europe")],
    "Dow": [site("dow-freeport",28.956,-95.354,"Freeport, Texas","United States","North America")],
    "BASF": [site("basf-ludwigshafen",49.506,8.429,"Ludwigshafen","Germany","Europe")],
    "Northstar Cell Materials": [site("northstar-quebec",46.81,-71.21,"Quebec City","Canada","North America")],
    "Duo Packaging": [site("duo-packaging",23.02,113.75,"Dongguan","China","East Asia")],
    "Duo Retail": [site("duo-retail",40.75,-73.99,"New York","United States","North America")],
    "Clearview Glass": [site("clearview-glass",37.80,-84.85,"Harrodsburg, Kentucky","United States","North America")],
}


# Product-owner supplied scripted sites; the named fictional firms are generated
# story actors, included in the 2,000-supplier total.
NAMED_SITES.update({
    "Great Lakes Silica": [site("great-lakes-illinois",41.35,-88.84,"Ottawa, Illinois","United States","North America")],
    "Pacific Freight": [site("pacific-freight-long-beach",33.77,-118.19,"Long Beach","United States","North America")],
    "Sumco": [site("sumco-tokyo",35.66,139.75,"Tokyo","Japan","East Asia")],
    "Wacker": [site("wacker-burghausen",48.18,12.83,"Burghausen","Germany","Europe")],
    "Bécancour Silicon": [site("becancour-silicon",46.34,-72.43,"Bécancour, Quebec","Canada","North America")],
    "Pohang Cathode": [site("pohang-cathode",36.02,129.34,"Pohang","South Korea","East Asia")],
    "Shenzhen PCB": [site("shenzhen-pcb",22.55,114.06,"Shenzhen","China","East Asia")],
})
STORY_CATEGORIES = {
    "Great Lakes Silica": (3,"raw"), "Pacific Freight": (3,"logistics"),
    "Sumco": (2,"components"), "Wacker": (2,"refining"),
    "Bécancour Silicon": (3,"raw"), "Pohang Cathode": (2,"refining"),
    "Shenzhen PCB": (2,"components"),
}

CLUSTERS = {
    "raw": [(46.81,-71.21,"Quebec City","Canada","North America"),(-10.716,25.473,"Kolwezi","Democratic Republic of the Congo","Africa"),(-23.65,-70.40,"Antofagasta","Chile","South America"),(-20.31,118.58,"Port Hedland","Australia","Oceania"),(-2.84,122.17,"Morowali","Indonesia","Southeast Asia")],
    "refining": [(35.54,129.31,"Ulsan","South Korea","East Asia"),(34.97,136.62,"Yokkaichi","Japan","East Asia"),(49.50,8.43,"Ludwigshafen","Germany","Europe"),(29.74,-95.02,"Baytown","United States","North America")],
    "components": [(24.80,120.99,"Hsinchu","Taiwan","East Asia"),(37.27,127.01,"Suwon","South Korea","East Asia"),(32.80,130.71,"Kumamoto","Japan","East Asia"),(23.02,113.75,"Dongguan","China","East Asia")],
    "assembly": [(34.54,113.85,"Zhengzhou","China","East Asia"),(22.55,114.06,"Shenzhen","China","East Asia"),(13.08,80.27,"Chennai","India","South Asia"),(21.03,105.85,"Hanoi","Vietnam","Southeast Asia")],
    "packaging": [(23.02,113.75,"Dongguan","China","East Asia"),(23.13,113.26,"Guangzhou","China","East Asia")],
    "logistics": [(34.05,-118.24,"Los Angeles","United States","North America"),(51.92,4.48,"Rotterdam","Netherlands","Europe"),(1.35,103.82,"Singapore","Singapore","Southeast Asia")],
    "retail": [(40.71,-74.01,"New York","United States","North America"),(51.51,-0.13,"London","United Kingdom","Europe"),(35.68,139.69,"Tokyo","Japan","East Asia")],
}
ITEMS = {
    "raw": [("cobalt","tonnes"),("lithium carbonate","tonnes"),("aluminum","tonnes")],
    "refining": [("polymer resin","tonnes"),("battery-grade lithium carbonate","tonnes")],
    "components": [("wafers","wafers"),("OLED panels","panels"),("cover glass","sheets"),("battery cells","cells"),("camera modules","modules"),("DRAM","chips"),("connectors","pieces")],
    "assembly": [("assembled iPhone Duo units","phones")],
    "packaging": [("packaging","cartons")],
    "logistics": [("freight","containers")],
    "retail": [("retail distribution services","lots")],
}


def generated_site(rng, number, category):
    lat,lon,city,country,region = rng.choice(CLUSTERS[category])
    return site(f"generated-site-{number:04d}", round(lat+rng.uniform(-0.12,0.12),6), round(lon+rng.uniform(-0.12,0.12),6),city,country,region)


def node_record(name, sites, *, tier=1, category="components", policy="naive", cash_need_bps=1000):
    first = asdict(sites[0])
    return {"id":name,"name":name,"role":"anchor" if name in ("Apple","Tesla") else "supplier", **{k:v for k,v in first.items() if k != "site_id"}, "sites":[asdict(s) for s in sites],"tier":tier,"category":category,"policy":policy,"cash_need_bps":cash_need_bps}
