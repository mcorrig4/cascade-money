import { SCENE_LOCATIONS, sceneTextAt } from './shots.ts';

export function SceneLabels({ shot, elapsed, cues={} }: { shot: number | null; elapsed: number; cues?:Record<string,number> }) {
  const location = SCENE_LOCATIONS.find(location => location.shot === shot);
  const cue = sceneTextAt(shot, elapsed,cues);
  return <>
    {location && <section className="scene-location" aria-label="Scene location"><strong>{location.name}</strong><span>{location.place}</span></section>}
    {cue && <div className="scene-narration" aria-label="Scene narration" data-cue={cue.id} style={{ opacity: cue.opacity, transform: `translateY(${cue.offset/10}vh)` }}><div>{cue.id==='derivatives'&&<span className="scene-cue-context">THE DERIVATIVES MARKET</span>}<p>{cue.text}</p></div></div>}
  </>;
}
