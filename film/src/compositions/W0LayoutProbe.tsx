import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {z} from 'zod';
import {AppSurface, PresentationPane} from '../components/AppSurface';
import {WindowLayout, useWindowGeometry} from '../components/WindowLayout';
import {presentationRect} from '../components/windowGeometry';
import {filmUnitFor} from '../components/appSurfaceGeometry';
import {W0_PROBE_SHOTS, W0_PROBE_SHOT_FRAMES} from './w0ProbeSchedule';

export const w0ProbeSchema = z.object({debugOutlines:z.boolean()});

export const W0LayoutProbe: React.FC<z.infer<typeof w0ProbeSchema>> = ({debugOutlines}) => {
  const frame=useCurrentFrame();
  const index=Math.min(W0_PROBE_SHOTS.length-1,Math.floor(frame/W0_PROBE_SHOT_FRAMES));
  const shot=W0_PROBE_SHOTS[index];
  const local=frame-index*W0_PROBE_SHOT_FRAMES;
  // One persistent WindowLayout also exercises fullscreen boundaries. No keyed
  // Sequence can mask a remount by intentionally restarting the test content.
  const spec=shot.spec.preset !== undefined ? shot.spec : {
    ...shot.spec,startFrame:shot.spec.startFrame+index*W0_PROBE_SHOT_FRAMES,
  };
  const geometry=useWindowGeometry(spec);
  const pane=presentationRect(geometry,shot.side,32*filmUnitFor(geometry.width,geometry.height));
  return <AbsoluteFill style={{background:'#071019',color:'#e8f1ed',fontFamily:'Inter, sans-serif'}}>
    <WindowLayout {...spec}>
      <AbsoluteFill style={{background:'repeating-linear-gradient(0deg, #152c38 0px, #152c38 1px, transparent 1px, transparent 90px), repeating-linear-gradient(90deg, #152c38 0px, #152c38 1px, #091721 1px, #091721 120px)',display:'grid',placeItems:'center'}}>
        <div style={{textAlign:'center',fontSize:48}}>WINDOW CONTENT<br/><span style={{fontSize:28}}>1920 × 1080 · reference grid</span></div>
      </AbsoluteFill>
    </WindowLayout>
    <AppSurface>
      <PresentationPane side={shot.side} geometry={geometry}>
        {/* Deliberately fixed: the card must remain inside the free column,
            including while that column collapses. Only layout is adapted. */}
        <div style={{position:'fixed',inset:0,display:'grid',alignItems:'center',background:'rgba(105,230,192,0.05)'}}>
          <section className="overlay-card cascade-totals" style={{width:'100%',padding:16,gridTemplateColumns:'minmax(0, 1fr)'}}>
            <div className="cascade-stat"><strong>$1</strong><span>USD</span></div>
          </section>
        </div>
      </PresentationPane>
    </AppSurface>
    {debugOutlines && <svg width={1920} height={1080} style={{position:'absolute',inset:0,pointerEvents:'none'}}>
      <polygon points={geometry.corners.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff6dcc" strokeWidth={3}/>
      <rect x={geometry.rect.left} y={geometry.rect.top} width={geometry.rect.width} height={geometry.rect.height} fill="none" stroke="#ff6dcc" strokeWidth={2} strokeDasharray="10 8"/>
      <rect x={pane.left} y={pane.top} width={pane.width} height={pane.height} fill="none" stroke="#67edff" strokeWidth={3}/>
    </svg>}
    <div style={{position:'absolute',left:24,top:12,padding:'12px 20px',background:'#071019',border:'1px solid #8297a5',fontSize:30,lineHeight:1.4}}>
      W0 · {String(index+1).padStart(2,'0')}/10 · {shot.label}<br/>
      <span style={{fontSize:20}}>Frame {frame} · shot {local}/89 · pane {shot.side} ({Math.round(pane.width)}px) · {debugOutlines ? 'pink: window / cyan: pane' : 'outlines off'}</span>
    </div>
  </AbsoluteFill>;
};
