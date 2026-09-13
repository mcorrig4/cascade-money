import { useEffect, useRef } from 'react';
export function Brand({ onDirector }: { onDirector: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 }), held = useRef(false);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => cancel, []);
  return <a className="brand" href="./" aria-label="Cascade home" title="Hold to open shot director"
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      if (window.__cascade?.frameDriven) { event.preventDefault(); return; }
      cancel(); held.current = false; start.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      timer.current = setTimeout(() => { held.current = true; onDirector(); }, 650);
    }}
    onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 12) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onContextMenu={event => event.preventDefault()}
    onClick={event => { if (held.current) { event.preventDefault(); held.current = false; } }}>
    <svg width="35" height="35" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 8h26M5 18h19M5 28h12" stroke="currentColor" strokeWidth="4" /></svg>
    <span>cascade<span className="brand-dot">.</span></span>
  </a>;
}
