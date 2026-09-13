import { Vector3, type Camera } from 'three';
import { siteFrame } from '../globe/site-math.ts';

/** Surface targets provide the geographic reference. A center-looking globe
 * camera sees the surface directly beneath its eye. Never reuse the prior up. */
export function worldNorth(position:Vector3,target:Vector3):Vector3 {
 const reference=target.lengthSq()>1e-16?target:position;
 const length=reference.length();
 const lat=length?Math.asin(Math.max(-1,Math.min(1,reference.y/length)))*180/Math.PI:0;
 const lng=Math.atan2(reference.x,reference.z)*180/Math.PI;
 return siteFrame(lat,lng,1).north;
}

export function cameraOrientation(camera:Camera,target:Vector3,allowRoll=false) {
 const north=worldNorth(camera.position,target);
 return {up:camera.up.toArray(),north:north.toArray(),
  angleDegrees:camera.up.angleTo(north)*180/Math.PI,allowRoll};
}

/** Called after all pose/controls writes and before rendering or label projection. */
export function applyCameraOrientation(camera:Camera,target:Vector3,allowRoll=false) {
 if(!allowRoll)camera.up.copy(worldNorth(camera.position,target));
 camera.lookAt(target);
 camera.updateMatrixWorld(true);
 return cameraOrientation(camera,target,allowRoll);
}
