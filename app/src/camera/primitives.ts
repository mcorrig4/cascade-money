export const EARTH_METERS=6_371_000;
export type Pose={lat:number;lng:number;altitude:number};
export type Center=Pick<Pose,'lat'|'lng'>;
export const SITE_CLEARANCE_METERS = 12;
export const CAMPUS_GROUND_METERS = 3.2;
export const HALL_FLOOR_METERS = -6.45;
export type GroundReference={site:string|null;lat:number;lng:number;groundMeters:number;minimumMeters:number};
/** Exterior floors are local tangent planes, not a sea-level altitude constant.
 * The modeled NYC interior is the only below-sphere exception, explicitly enabled
 * by its renderer after the model has loaded. Its 5.4m room uses 1.5m eye clearance.
 */
export function cameraGround(pose:Pose, interior=false):GroundReference {
  const candidates=[{site:'apple-park',lat:37.3349,lng:-122.009,groundMeters:CAMPUS_GROUND_METERS},
    {site:'fifth-avenue',lat:40.7638,lng:-73.973,groundMeters:0}];
  for(const site of candidates){
    const north=(pose.lat-site.lat)*Math.PI/180*EARTH_METERS;
    const east=longitudeDelta(site.lng,pose.lng)*Math.PI/180*EARTH_METERS*Math.cos(site.lat*Math.PI/180);
    if(Math.hypot(north,east)>2500)continue;
    const hall=interior&&site.site==='fifth-avenue'&&Math.abs(east)<24&&Math.abs(north)<21;
    return {...site,groundMeters:hall?HALL_FLOOR_METERS:site.groundMeters,minimumMeters:hall?1.5:SITE_CLEARANCE_METERS};
  }
  // Globe markers are removed before the camera enters close range; only the
  // sphere remains there. An explicit reference can add a terrain envelope.
  return {site:null,lat:pose.lat,lng:pose.lng,groundMeters:0,minimumMeters:SITE_CLEARANCE_METERS};
}
export function cameraClearance(pose:Pose,reference=cameraGround(pose)) {
  const a=pose.lat*Math.PI/180,b=reference.lat*Math.PI/180,d=(pose.lng-reference.lng)*Math.PI/180;
  const cosine=Math.sin(a)*Math.sin(b)+Math.cos(a)*Math.cos(b)*Math.cos(d);
  const height=((1+pose.altitude)*cosine-1)*EARTH_METERS;
  return {...reference,actualMeters:height-reference.groundMeters};
}
export function clampCamera(pose:Pose,reference=cameraGround(pose)):Pose {
  const info=cameraClearance(pose,reference);
  if(info.actualMeters>=reference.minimumMeters)return pose;
  const cosine=(info.actualMeters+reference.groundMeters+EARTH_METERS)/((1+pose.altitude)*EARTH_METERS);
  return {...pose,altitude:(1+(reference.groundMeters+reference.minimumMeters)/EARTH_METERS)/cosine-1};
}
export type Ease={kind:'cubic'}|{kind:'cubic-out';handoff?:number}|{kind:'bezier';points:[number,number,number,number]};
export type Route='shortest'|'west'|'east';
export type Keyframe=Pose & {t:number;tangent?:Pose};
export type Primitive={kind:'orbit';center:Center;radius:number;angularSpeed:number;bearing:number}|{kind:'spline';keyframes:Keyframe[]}|{kind:'fly'};
export type CameraCommand=Pose & {velocity?:Pose;landmarkPath?:'apple-park-arch';id:number;duration:number;bookmarkPath?:boolean;site?:'apple-park'|'fifth-avenue';ease?:Ease;route?:Route;from?:Pose;primitive?:Primitive};
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function easeAt(t:number,ease:Ease={kind:'cubic'}) {
  t=clamp(t);
  if(ease.kind==='cubic-out'){
    const h=clamp(ease.handoff??0);
    if(h>0&&t<h){
      // C1 Hermite entrance joins the unmodified cubic ease-out at h.
      // Its zero initial slope leaves room for the incoming camera velocity.
      const u=t/h,end=1-(1-h)**3,slope=3*(1-h)**2;
      return (-2*u**3+3*u*u)*end+(u**3-u*u)*h*slope;
    }
    return 1-(1-t)**3;
  }
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
  return clampCamera({lat:lat*180/Math.PI,lng,altitude});
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
  return clampCamera(result);
}
export function sampleCamera(command:CameraCommand,elapsedMs:number):Pose {
  const t=command.duration<=0?1:clamp(elapsedMs/command.duration),from=command.from??command,p=command.primitive;
  if(p?.kind==='orbit')return orbitAt(p.center,p.radius,command.altitude,p.bearing+p.angularSpeed*Math.min(elapsedMs,command.duration)/1000);
  if(p?.kind==='spline')return splineAt(p.keyframes,t*p.keyframes.at(-1)!.t);
  const eased=easeAt(t,command.ease);
  const h=command.ease?.kind==='cubic-out'?clamp(command.ease.handoff??0):0,u=h>0?t/h:1;
  const carry=u<1?(u**3-2*u*u+u)*h*command.duration:0;
  return clampCamera({lat:from.lat+(command.lat-from.lat)*eased+(command.velocity?.lat??0)*carry,
    lng:from.lng+longitudeDelta(from.lng,command.lng,command.route)*eased+(command.velocity?.lng??0)*carry,
    altitude:from.altitude+(command.altitude-from.altitude)*eased+(command.velocity?.altitude??0)*carry});
}
/** Deliberately named extension point: no underground geometry/camera is fabricated. */
export const SUBSURFACE_INTERIOR_CAMERA_HOOK='subsurface-interior-camera';


export type Bookmark = Pose & { sceneId:number|null; time:number; heading?:number; tilt?:number; holdMs:number; travelMs:number };
export type CameraBookmark = Bookmark;
export type BookmarkInput = Omit<Bookmark,'holdMs'|'travelMs'> & Partial<Pick<Bookmark,'holdMs'|'travelMs'>>;
export function normalizeBookmarks(value:unknown):Bookmark[] {
 if(!Array.isArray(value))throw new Error('Expected a bookmark array');
 return value.map(b=>{
  if(!b||typeof b!=='object')throw new Error('Invalid bookmark');
  const result={...b,holdMs:b.holdMs??0,travelMs:b.travelMs??2500} as Bookmark;
  if(![result.lat,result.lng,result.altitude,result.time,result.holdMs,result.travelMs].every(Number.isFinite)
   || Math.abs(result.lat)>90 || result.altitude<0 || result.holdMs<0 || result.travelMs<=0
   || !(result.sceneId===null||Number.isInteger(result.sceneId)))throw new Error('Invalid bookmark pose or timing');
  return result;
 });
}
/** One nonuniform Catmull-Rom path; duplicate zero-tangent knots encode dwell. */
export function fromBookmarks(input:BookmarkInput[]):Keyframe[] {
 const bookmarks=normalizeBookmarks(input);
 if(bookmarks.length<2)throw new Error('At least two bookmarks are required');
 const keys:Keyframe[]=[];let t=0,lng=bookmarks[0].lng;
 const zero={lat:0,lng:0,altitude:0};
 bookmarks.forEach((b,i)=>{
  if(i){t+=b.travelMs/1000;lng+=longitudeDelta(bookmarks[i-1].lng,b.lng);}
  const key:Keyframe={lat:b.lat,lng,altitude:b.altitude,t};
  if(b.holdMs>0)key.tangent={...zero};
  keys.push(key);
  if(b.holdMs>0){t+=b.holdMs/1000;keys.push({...key,t,tangent:{...zero}});}
 });
 return keys;
}
