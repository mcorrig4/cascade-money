import {CatmullRomCurve3, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector3} from 'three';
import type {GlobeInstance} from 'globe.gl';
import type {LiveArc} from './arc-pool.ts';

/** Frame-driven arc geometry without globe.gl's deferred digest/tween lifecycle. */
export class DeterministicArcLayer {
  private readonly active = new Map<number, Group>();
  constructor(private readonly globe: GlobeInstance) {}

  update(arcs: LiveArc[]) {
    const wanted = new Set(arcs.map(arc => arc.id));
    for (const [id, group] of this.active) if (!wanted.has(id)) {
      group.removeFromParent();
      group.traverse(object => { const mesh=object as Mesh; mesh.geometry?.dispose(); if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose(); });
      this.active.delete(id);
    }
    const radius = this.globe.getGlobeRadius();
    for (const arc of arcs) {
      let group = this.active.get(arc.id);
      if (!group) {
        const startRaw=this.globe.getCoords(arc.startLat,arc.startLng,0),endRaw=this.globe.getCoords(arc.endLat,arc.endLng,0);
        const start=new Vector3(startRaw.x,startRaw.y,startRaw.z).normalize(),end=new Vector3(endRaw.x,endRaw.y,endRaw.z).normalize();
        const omega=Math.acos(Math.max(-1,Math.min(1,start.dot(end)))),sinOmega=Math.sin(omega),points:Vector3[]=[];
        for(let i=0;i<=64;i++){
          const t=i/64;
          const direction=sinOmega<1e-8?start.clone().lerp(end,t).normalize():start.clone().multiplyScalar(Math.sin((1-t)*omega)/sinOmega).addScaledVector(end,Math.sin(t*omega)/sinOmega).normalize();
          points.push(direction.multiplyScalar(radius*(1+arc.altitude*Math.sin(Math.PI*t))));
        }
        const geometry=new TubeGeometry(new CatmullRomCurve3(points),64,.11,4,false),stride=5,rel:number[]=[];
        for(let ring=0;ring<=64;ring++)for(let side=0;side<stride;side++)rel.push(1-ring/64);
        geometry.setAttribute('relDistance',new Float32BufferAttribute(rel,1));
        const mesh=new Mesh(geometry,new MeshBasicMaterial({transparent:true}));
        group=new Group();group.name=`Cascade arc ${arc.id}`;group.userData.skipBloom=false;group.add(mesh);this.globe.scene().add(group);this.active.set(arc.id,group);
      }
      (arc as LiveArc & {__threeObjArc?:Group}).__threeObjArc=group;
    }
  }

  dispose(){this.update([]);}
}
