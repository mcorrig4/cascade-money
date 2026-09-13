// Local monogram fallback: Simple Icons is absent from node_modules and the local store.
export const BRANDS: Record<string, { mark: string; color: string }> = {
  Apple: { mark: 'A', color: '#f5f5f7' }, Tesla: { mark: 'T', color: '#e82127' },
  Foxconn: { mark: 'F', color: '#005ca9' }, TSMC: { mark: 'TS', color: '#d71920' },
  Samsung: { mark: 'S', color: '#1428a0' }, Corning: { mark: 'C', color: '#005a9c' },
  Sony: { mark: 'S', color: '#ffffff' }, LG: { mark: 'LG', color: '#a50034' },
  Panasonic: { mark: 'P', color: '#0041c0' }, CATL: { mark: 'CA', color: '#0066b3' },
  Glencore: { mark: 'G', color: '#c9d4db' }, Exxon: { mark: 'EX', color: '#ed1c24' },
  Shell: { mark: 'SH', color: '#fbce07' }, Dow: { mark: 'D', color: '#e1251b' },
  BASF: { mark: 'B', color: '#65ac1e' }, Qualcomm: { mark: 'Q', color: '#3253dc' },
  Broadcom: { mark: 'B', color: '#cc092f' }, 'SK Hynix': { mark: 'SK', color: '#ea002c' },
  Murata: { mark: 'M', color: '#e50012' }, Luxshare: { mark: 'LX', color: '#005bac' },
  Pegatron: { mark: 'PG', color: '#ed6c00' }, Sumco: { mark: 'SU', color: '#0055a5' },
  Wacker: { mark: 'W', color: '#004a99' },
};
// Case/whitespace-insensitive: firm names arrive from sim-generated data, so tolerate stray
// leading/trailing space or inconsistent casing rather than silently falling through to the
// two-letter generated-initials monogram.
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
export function brandFor(name: string) {
  const key = Object.keys(BRANDS).find(key => normalize(name).startsWith(normalize(key)));
  return key ? BRANDS[key] : { mark: name.slice(0, 2).toUpperCase(), color: '#bcced0' };
}

// Official wordmark/logo SVGs (public/logos/<slug>.svg), single-color normalized for the dark
// globe. Keyed the same way as BRANDS (case-insensitive prefix match on firm.name). A brand with
// no entry here keeps the local monogram fallback from BRANDS/brandFor above — either because no
// clean, freely-licensed vector mark exists (Shell's pecten, Luxshare) or none was sourced yet.
// See public/logos/LICENSES.md for source + license per file.
export const LOGOS: Record<string, string> = {
  Apple: 'apple', Tesla: 'tesla', Foxconn: 'foxconn', TSMC: 'tsmc', Samsung: 'samsung',
  Corning: 'corning', Sony: 'sony', LG: 'lg', Panasonic: 'panasonic', CATL: 'catl',
  Glencore: 'glencore', Exxon: 'exxon', Dow: 'dow', BASF: 'basf', Qualcomm: 'qualcomm',
  Broadcom: 'broadcom', 'SK Hynix': 'sk-hynix', Murata: 'murata', Pegatron: 'pegatron',
  Wacker: 'wacker', Sumco: 'sumco',
};
// Real-named companies with no logo file: their official mark could not be sourced as a clean,
// freely-licensed SVG. Shell's pecten emblem and Luxshare's mark are not available under a free
// license on Wikimedia Commons (checked again when this shipped), so they keep the monogram
// fallback deliberately.
export const MONOGRAM_ONLY = ['Shell', 'Luxshare'];

export function logoFor(name: string): string | undefined {
  const key = Object.keys(LOGOS).find(key => normalize(name).startsWith(normalize(key)));
  return key ? LOGOS[key] : undefined;
}
