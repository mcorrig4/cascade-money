export function Icon({ name }: { name: 'play' | 'pause' | 'replay' | 'left' | 'right' | 'close' | 'expand' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'play' && <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />}
    {name === 'pause' && <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>}
    {name === 'replay' && <><path d="M4 9a8 8 0 1 1 0 6M4 3v6h6" /></>}
    {name === 'left' && <path d="m14 6-6 6 6 6" />}
    {name === 'right' && <path d="m10 6 6 6-6 6" />}
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    {name === 'expand' && <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />}
  </svg>;
}
