import type { PlaybackState } from '../playback/engine.ts';
import { SHOTS } from './shots.ts';
export const COMPANY_BEATS = [
  {shot:1,company:'Apple',at:1}, {shot:2,company:'Apple',at:.8},
  {shot:3,company:'Apple',at:3}, {shot:3,company:'Samsung Display',at:4.4}, {shot:3,company:'Corning',at:9.2},
  {shot:15,company:'Samsung Display',at:.5}, {shot:15,company:'Apple',at:1.2}, {shot:15,company:'Corning',at:5},
  {shot:4,company:'Apple',at:.2}, {shot:4,company:'Samsung Display',at:1}, {shot:4,company:'Corning',at:8.4},
];
export function companyCues(state:PlaybackState) {
  const shot=SHOTS.find(s=>s.id===state.shot),scale=shot?shot.seconds/shot.baseSeconds:1;
  return [...COMPANY_BEATS.filter(b=>b.shot===state.shot).map(b=>({company:b.company,atMs:b.at*1000*scale})),...state.companyCues];
}
