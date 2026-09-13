import type {WindowLayoutSpec, WindowPreset} from '../components/windowGeometry';

export const W0_PROBE_SHOT_FRAMES = 90;
// Three contact-sheet samples per shot: held start, midpoint, held finish.
export const W0_PROBE_SHOTS: readonly {label: string; side: 'left' | 'right'; spec: WindowLayoutSpec}[] = [
  ...(['skewLeft','centerSmall','skewRight','centerLarge','fullscreen'] as WindowPreset[]).map(preset => ({
    label:preset, side: preset === 'skewRight' ? 'left' as const : 'right' as const, spec:{preset},
  })),
  {label:'skewLeft → centerSmall',side:'right',spec:{from:'skewLeft',to:'centerSmall',startFrame:15,durationInFrames:60}},
  {label:'centerSmall → skewRight',side:'left',spec:{from:'centerSmall',to:'skewRight',startFrame:15,durationInFrames:60}},
  {label:'skewRight → centerLarge',side:'left',spec:{from:'skewRight',to:'centerLarge',startFrame:15,durationInFrames:60}},
  {label:'fullscreen → skewLeft',side:'right',spec:{from:'fullscreen',to:'skewLeft',startFrame:15,durationInFrames:60}},
  {label:'skewRight → fullscreen',side:'left',spec:{from:'skewRight',to:'fullscreen',startFrame:15,durationInFrames:60}},
];
