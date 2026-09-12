export type PageRoute = 'architecture' | 'globe' | 'not-found';
export function resolveRoute(pathname: string, hash = ''): PageRoute {
  // History is canonical; retain a hash fallback for hosts without rewrites.
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/architecture' || (path === '/' && /^#\/architecture(?:\/[a-z0-9-]+)?\/?$/.test(hash))) return 'architecture';
  return path === '/' ? 'globe' : 'not-found';
}
