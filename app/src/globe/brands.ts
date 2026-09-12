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
export function brandFor(name: string) {
  const key = Object.keys(BRANDS).find(key => name.toLowerCase().startsWith(key.toLowerCase()));
  return key ? BRANDS[key] : { mark: name.slice(0, 2).toUpperCase(), color: '#bcced0' };
}
