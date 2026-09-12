export const EARTH_METERS=6_371_000;
export type Pose={lat:number;lng:number;altitude:number};
export type Center=Pick<Pose,'lat'|'lng'>;
export type Ease={kind:'cubic'}|{kind:'bezier';points:[number,number,number,number]};
export type Route='shortest'|'west'|'east';
export type Keyframe=Pose & {t:number;tangent?:Pose};
export type Primitive={kind:'orbit';center:Center;radius:number;angularSpeed:number;bearing:number}|{kind:'spline';keyframes:Keyframe[]}|{kind:'fly'};
export type CameraCommand=Pose & {landmarkPath?:'apple-park-arch';id:number;duration:number;site?:'apple-park'|'fifth-avenue';ease?:Ease;route?:Route;from?:Pose;primitive?:Primitive};
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function easeAt(t:number,ease:Ease={kind:'cubic'}) {
  t=clamp(t);
  if(ease.kind==='cubic')return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const [x1,y1,x2,y2]=ease.points;
  const curve=(u:number,a:number,b:number)=>3*(1-u)**2*u*a+3*(1-u)*u*u*b+u**3;
  let lo=0,hi=1;
  for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(curve(mid,x1,x2)<t)lo=mid;else hi=mid;}
  return curve((lo+hi)/2,y1,y2);
}
export function longitudeDelta(from:number,to:number,route:Route='shortest') {
  const east=((to-from)%360+360)%360;
  return route==='east'?east:route==='west'?(east===0?0:east-360):(east>180?east-360:east);
}
export function orbitAt(center:Center,radius:number,altitude:number,bearing:number):Pose {
  const a=radius/EARTH_METERS,phi=center.lat*Math.PI/180,theta=bearing*Math.PI/180;
  const lat=Math.asin(Math.sin(phi)*Math.cos(a)+Math.cos(phi)*Math.sin(a)*Math.cos(theta));
  const lng=center.lng+Math.atan2(Math.sin(theta)*Math.sin(a)*Math.cos(phi),Math.cos(a)-Math.sin(phi)*Math.sin(lat))*180/Math.PI;
  return {lat:lat*180/Math.PI,lng,altitude};
}
export function splineAt(keys:Keyframe[],t:number):Pose {
  t=Math.max(keys[0].t,Math.min(keys.at(-1)!.t,t));
  const i=Math.min(keys.length-2,Math.max(0,keys.findIndex((k,j)=>j<keys.length-1&&t<=keys[j+1].t)));
  const a=keys[i],b=keys[i+1],span=b.t-a.t,u=(t-a.t)/span;
  const result={} as Pose;
  for(const field of ['lat','lng','altitude'] as const){
    const prev=keys[Math.max(0,i-1)],next=keys[Math.min(keys.length-1,i+2)];
    const m0=a.tangent?.[field]??(b[field]-prev[field])/(b.t-prev.t);
    const m1=b.tangent?.[field]??(next[field]-a[field])/(next.t-a.t);
    result[field]=(2*u**3-3*u*u+1)*a[field]+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*b[field]+(u**3-u*u)*span*m1;
  }
  result.altitude=Math.max(.0000002,result.altitude);return result;
}
export function sampleCamera(command:CameraCommand,elapsedMs:number):Pose {
  const t=command.duration<=0?1:clamp(elapsedMs/command.duration),from=command.from??command,p=command.primitive;
  if(p?.kind==='orbit')return orbitAt(p.center,p.radius,command.altitude,p.bearing+p.angularSpeed*Math.min(elapsedMs,command.duration)/1000);
  if(p?.kind==='spline')return splineAt(p.keyframes,t*p.keyframes.at(-1)!.t);
  const eased=easeAt(t,command.ease);
  return {lat:from.lat+(command.lat-from.lat)*eased,lng:from.lng+longitudeDelta(from.lng,command.lng,command.route)*eased,altitude:from.altitude+(command.altitude-from.altitude)*eased};
}
/** Deliberately named extension point: no underground geometry/camera is fabricated. */
export const SUBSURFACE_INTERIOR_CAMERA_HOOK='subsurface-interior-camera';
