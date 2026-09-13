export const CUE_NAMES = [
  'Samsung','Corning','Sony',
  'date-card','stat-suppliers','stat-factories','stat-countries','stat-cost','system-recreated','payment-layer',
  'rows-in','dates-line','question-card','committed-counter','settled-counter','companies-counter','tagline',
  'coin','coin-date','coin-yield','swap','earlier-pays-later','extend','final-card',
  'backing-card','contract','kicker','op-extensions','op-transfers','op-redemptions','op-sales',
  'law-ownership','law-yield','word-loans','word-forwards','word-bonds','word-derivatives',
  'money-plus-time','final-line','promises','before-cash','close-line','wordmark','company',
  // Scene 3 (the example) — every beat keyed to a word of the recorded v9 take.
  'chain-fanout','parts-move','money-waits',
  'display-maker','owes-glass','glass-maker','pay-today','incoming-value','obligation',
] as const;
export type CueName = typeof CUE_NAMES[number];
export type CueClock = {shotElapsed:number;shotDuration:number;cues:Record<string,number>};
/** Authored defaults follow narration scaling; explicit cues are exact local ms. */
export function cueMs(state:CueClock,name:string,defaultSeconds:number,baseSeconds:number) {
  return state.cues[name] ?? defaultSeconds*1000*(state.shotDuration/baseSeconds || 1);
}
export const entrance = (tMs:number,startMs:number,duration=350) => Math.max(0,Math.min(1,(tMs-startMs)/duration));
export function revealStyle(tMs:number,startMs:number,duration=350) {
  const opacity=entrance(tMs,startMs,duration);
  return {opacity,transform:`translateY(${(1-opacity)*1.1}vh)`};
}
export function calloutMotion(tMs:number,startMs:number,holdMs=3200) {
  const age=tMs-startMs,alpha=Math.min(entrance(age,0,300),1-entrance(age,holdMs,350));
  return {alpha,offset:(1-alpha)*18,visible:age>=0&&age<holdMs+350};
}
