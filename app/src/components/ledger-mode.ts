export const ledgerMode = (running:boolean, inspecting:boolean) => running && !inspecting ? 'compact' : 'expanded';
export const logDuration = (rate:number) => Math.max(24, 180 / Math.sqrt(Math.max(1,rate)));
/** Match film.css's canonical 1080p row geometry; portrait retains its own layout. */
export const ledgerRowHeight = (mode:'compact'|'expanded', viewport?:{width:number;height:number}) => {
  if(viewport && viewport.width / viewport.height >= 4/3) {
    const scale=Math.min(viewport.width/1920,viewport.height/1080);
    return (mode==='compact'?54:220)*scale;
  }
  return mode==='compact'?30:160;
};

/** Retain references to the displayed slice, independent of live-day admission. */
export function inspectionSnapshot<T extends {seq:number}>(day:number, events:readonly T[], selectedSeq?:number) {
  const selectedIndex=Math.max(0,events.findIndex(e=>e.seq===selectedSeq));
  return {day,events:[...events],selectedIndex,selectedSeq:events[selectedIndex]?.seq};
}
