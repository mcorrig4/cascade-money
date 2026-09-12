import { useCallback, useEffect, useRef, useState } from 'react';

export function useDiagramProgress(steps: number, mode: 'scroll' | 'enter' = 'scroll') {
  const host = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(steps);
  const [reduced, setReduced] = useState(false);
  const replaying = useRef(false);
  const manual = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; replaying.current = false; }, []);
  const replay = useCallback(() => {
    clear(); manual.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(steps); return; }
    replaying.current = true; setProgress(0);
    for (let step = 1; step <= steps; step++) timers.current.push(setTimeout(() => {
      setProgress(step);
      if (step === steps) replaying.current = false;
    }, step * 650));
  }, [clear, steps]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const configure = () => {
      clear(); manual.current = false; observer?.disconnect(); setReduced(preference.matches);
      if (preference.matches || !('IntersectionObserver' in window)) { setProgress(steps); return; }
      setProgress(0);
      observer = new IntersectionObserver(entries => {
        if (replaying.current || manual.current) return;
        for (const entry of entries) if (entry.isIntersecting) {
          if (mode === 'enter') {
            observer?.disconnect(); replay(); return;
          }
          const step = Number(entry.target.getAttribute('data-step'));
          setProgress(previous => Math.max(previous, step));
        }
      }, { threshold: 0.08 });
      if (mode === 'enter') {
        if (host.current) observer.observe(host.current);
      } else host.current?.querySelectorAll('[data-step]').forEach(element => observer!.observe(element));
    };
    configure(); preference.addEventListener('change', configure);
    return () => { observer?.disconnect(); preference.removeEventListener('change', configure); clear(); };
  }, [steps, mode, clear, replay]);
  const showAll = useCallback(() => { clear(); manual.current = true; setProgress(steps); }, [clear, steps]);
  return { host, progress, reduced, replay, showAll };
}
