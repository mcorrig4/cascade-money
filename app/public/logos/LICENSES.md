# Company logo sources

Each SVG in this directory is a single-color, tight-viewBox derivative of the file below,
made by stripping editor metadata/comments and recoloring every shape to the brand's existing
accent color from `app/src/globe/brands.ts` (chosen for legibility on the dark globe). Shape and
proportions are unmodified from the source. Company names and logos remain trademarks of their
respective owners; use here is nominative (identifying the real company at a real supply-chain
site) and not an endorsement.

| File | Company | Source | License (per Commons file page) |
| --- | --- | --- | --- |
| apple.svg | Apple | https://commons.wikimedia.org/wiki/File:Apple_logo_white.svg | Public domain (PD-textlogo/PD-simple, trademark still applies) |
| tesla.svg | Tesla | https://commons.wikimedia.org/wiki/File:Tesla_T_symbol_-_white.svg | Public domain (PD-textlogo, trademark still applies) |
| foxconn.svg | Foxconn | https://commons.wikimedia.org/wiki/File:Foxconn_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| tsmc.svg | TSMC | https://commons.wikimedia.org/wiki/File:TSMC_wordmark.svg | Public domain (PD-textlogo, trademark still applies) |
| samsung.svg | Samsung (incl. Samsung Display) | https://commons.wikimedia.org/wiki/File:Samsung_wordmark.svg | Public domain (PD-textlogo, trademark still applies) |
| corning.svg | Corning | https://commons.wikimedia.org/wiki/File:Corning_Incorporated_Logo.svg | Public domain (PD-textlogo, trademark still applies) |
| sony.svg | Sony | https://commons.wikimedia.org/wiki/File:Sony_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| lg.svg | LG (incl. LG Energy) | https://commons.wikimedia.org/wiki/File:LG_logo_(2014).svg | Public domain (PD-textlogo, trademark still applies) |
| panasonic.svg | Panasonic | https://commons.wikimedia.org/wiki/File:Panasonic_logo_(Blue).svg | Public domain (PD-textlogo, trademark still applies) |
| catl.svg | CATL | https://commons.wikimedia.org/wiki/File:Contemporary_Amperex_Technology_2020_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| glencore.svg | Glencore | https://commons.wikimedia.org/wiki/File:Glencore_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| exxon.svg | Exxon | https://commons.wikimedia.org/wiki/File:Exxon_Mobil_Logo.svg | Public domain (PD-textlogo, trademark still applies) |
| dow.svg | Dow | https://commons.wikimedia.org/wiki/File:Dow_Chemical_Company_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| basf.svg | BASF | https://commons.wikimedia.org/wiki/File:BASF-Logo.svg | Public domain (PD-textlogo, trademark still applies) |
| qualcomm.svg | Qualcomm | https://commons.wikimedia.org/wiki/File:Qualcomm-Logo.svg | Public domain (PD-textlogo, trademark still applies) |
| broadcom.svg | Broadcom | https://commons.wikimedia.org/wiki/File:Broadcom_logo_(2016-present).svg | Public domain (PD-textlogo, trademark still applies) |
| sk-hynix.svg | SK Hynix | https://commons.wikimedia.org/wiki/File:SK_Hynix.svg | Public domain (PD-textlogo, trademark still applies) |
| murata.svg | Murata | https://commons.wikimedia.org/wiki/File:Murata_Manufacturing_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| pegatron.svg | Pegatron | https://commons.wikimedia.org/wiki/File:Pegatron_logo.svg | Public domain (PD-textlogo, trademark still applies) |
| wacker.svg | Wacker | https://commons.wikimedia.org/wiki/File:Wacker_Chemie.svg | Public domain (PD-textlogo, trademark still applies) |

## Kept on the monogram fallback (no logo file)

- **Shell** — Shell's pecten (shell) emblem is a complex graphic mark, not a simple text/shape
  logo, so it is not eligible for Commons' PD-textlogo/PD-simple treatment and is hosted (where
  hosted at all) only under non-free fair-use terms on English Wikipedia, not on Commons as a
  freely licensed file. No clean, freely-licensed SVG was available; keeps the `SH` monogram.
- **Luxshare** — no vector (SVG) logo found on Wikimedia Commons at all, only a low-resolution
  raster (`File:Luxshare.png`), which the "no raster" rule excludes. Keeps the `LX` monogram.
- **Sumco** — a clean SVG exists (`File:Sumco_Logo.svg`), but `upload.wikimedia.org` returned
  HTTP 429 (rate limit) for that specific file on every fetch attempt during this change, so no
  usable copy was obtained in time. Keeps the `SU` monogram for now; re-attempt the fetch and
  add `sumco.svg` + a `LOGOS.Sumco` entry in `app/src/globe/brands.ts` in a follow-up.

All other real-named companies in the baked world (Great Lakes Silica, Great Plains Rail, Duo
Packaging, Duo Retail, Clearview Glass, Pacific Freight, Bécancour Silicon, Pohang Cathode,
Shenzhen PCB, Ohio Valley Chemicals, Superior Sands Refining, Northstar Cell Materials, Window
Fund, Curve Seller, and all `Supplier NNNN` nodes) are invented/fictional and intentionally keep
their generated initials monogram.
