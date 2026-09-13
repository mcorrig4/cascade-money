import {normalizeBookmarks,type Bookmark,type Pose} from '../camera/primitives.ts';
export class CameraBookmarks {
 readonly items:Bookmark[]=[];
 append(pose:Pose,sceneId:number|null,time:number) {
  const bookmark={...pose,sceneId,time,holdMs:0,travelMs:2500};this.items.push(bookmark);return bookmark;
 }
 load(json:string){const next=normalizeBookmarks(JSON.parse(json));this.items.splice(0,this.items.length,...next);return this.items;}
 json(){return JSON.stringify(normalizeBookmarks(this.items),null,2);}
 async export(write=(json:string)=>navigator.clipboard.writeText(json),log=(json:string)=>console.log(json)){
  const json=this.json();log(json);await write(json);return json;
 }
}
