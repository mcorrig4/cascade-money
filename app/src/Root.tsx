import { lazy, Suspense, useEffect, useState } from 'react';
import { resolveRoute } from './architecture/routing.ts';
const GlobeApp = lazy(() => import('./App.tsx'));
const ArchitecturePage = lazy(() => import('./architecture/ArchitecturePage.tsx'));

export default function Root() {
  const [route, setRoute] = useState(() => resolveRoute(location.pathname, location.hash));
  useEffect(() => {
    const update = () => setRoute(resolveRoute(location.pathname, location.hash));
    window.addEventListener('popstate', update); window.addEventListener('hashchange', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); };
  }, []);
  if (route === 'not-found') return <main className="loading"><h1>Page not found</h1><p><a href="/architecture">Read the architecture</a> · <a href="/">Open Cascade</a></p></main>;
  return <Suspense fallback={<main className="loading"><span className="eyebrow">CASCADE</span><h1>Opening {route === 'architecture' ? 'the architecture' : 'the network'}…</h1></main>}>
    {route === 'architecture' ? <ArchitecturePage /> : <GlobeApp />}
  </Suspense>;
}
