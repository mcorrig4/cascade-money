# Geographic inputs

The user-specified firm/site list is embedded in `sim/geography.py`. Pins are
approximate coordinates intended for globe storytelling, not facility surveys.
Generated suppliers use seeded jitter around a small table of industrial
clusters. Firm names, sites and regional placement are distinct from the
fictional invoices: none of the simulated purchase relationships asserts an
actual contract or a verified product bill of materials.

Official reference pages corroborate several named locations:

- [Apple contact information](https://www.apple.com/contact/) — Apple Park, Cupertino.
- [Tesla contact information](https://www.tesla.com/contact) — Fremont and Austin.
- [TSMC business contacts](https://www.tsmc.com/english/aboutTSMC/business_contacts) — Hsinchu.
- [Corning's Kentucky glass manufacturing](https://www.corning.com/worldwide/en/the-progress-report/crystal-clear/making-iphone-glass-in-kentucky) — Harrodsburg.

The remaining locations follow the explicit product brief. Site IDs are stable;
firms with multiple sites expose every site in their node's `sites` list. Invoice
`deliver_to` is a site ID and can identify a third-party assembler. All named
scripted annotations, including the retained Phase A fixture, are editable in
`sim/story_annotations.json`.

The corrected scripts add Sumco in Tokyo and Wacker in Burghausen. Great Lakes
Silica (Ottawa, Illinois), Pacific Freight (Long Beach), Bécancour Silicon
(Quebec), Pohang Cathode (Pohang) and Shenzhen PCB (Shenzhen) are fictional
suppliers with fixed pins. These firms count within the 2,000-supplier total.
Apple consigns its directly purchased components to Foxconn; supplier payments
then follow each supplier's own input chain. The display chain is the early
four-times proof; no scripted TSMC-to-Corning payment remains.

The branching proof additionally pins fictional Ohio Valley Chemicals in Marietta, Ohio; Superior Sands Refining in Superior, Wisconsin; and Great Plains Rail in Kansas City, Missouri. They count within the default 2,000 suppliers.
