// NASA equirectangular atlas: west seam -180°, east seam +180°, north at top.
export const normalizeLongitude = (lng: number) => ((lng + 180) % 360 + 360) % 360 - 180;
export const atlasUv = (lat: number, lng: number) => ({ u: (normalizeLongitude(lng) + 180) / 360, v: (lat + 90) / 180 });
export const GEO_REFERENCES = [
  { name: 'Apple · Cupertino', lat: 37.3349, lng: -122.009 },
  { name: 'TSMC · Taiwan', lat: 24.773, lng: 121.012 },
  { name: 'Samsung Display · Asan', lat: 36.797, lng: 127.059 },
  { name: 'Corning · Kentucky', lat: 37.772, lng: -84.837 },
  { name: 'Glencore · Kolwezi', lat: -10.716, lng: 25.473 },
];
