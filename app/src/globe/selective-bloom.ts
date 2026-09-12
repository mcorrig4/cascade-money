import {
  Color, HalfFloatType, MeshBasicMaterial, PointsMaterial, LineBasicMaterial, ShaderMaterial,
  Vector2, WebGLRenderTarget,
} from 'three';
import type { Camera, Material, Object3D, Scene, WebGLRenderer } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

type Renderable = Object3D & { material: Material | Material[]; isMesh?: boolean; isPoints?: boolean; isLine?: boolean };
function isArc(object: Object3D): boolean {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    if ((parent as Object3D & { __globeObjType?: string }).__globeObjType === 'arc') return true;
  }
  return false;
}
/** Selective half-resolution bloom; the main scene and HTML UI never get blurred. */
export class ArcBloomPass extends Pass {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private quad: FullScreenQuad;
  private material: ShaderMaterial;
  private scene: Scene;
  private blackMesh = new MeshBasicMaterial({ color: 0x000000 });
  private blackPoints = new PointsMaterial({ color: 0x000000, size: 0 });
  private blackLine = new LineBasicMaterial({ color: 0x000000 });
  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    super(); this.scene = scene;
    this.composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType }));
    this.composer.renderToScreen = false;
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.65, 0.3, 0.18);
    this.composer.addPass(this.bloom);
    this.material = new ShaderMaterial({
      uniforms: { baseTexture: { value: null }, glowTexture: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D glowTexture; varying vec2 vUv; void main(){vec4 base=texture2D(baseTexture,vUv);vec3 glow=texture2D(glowTexture,vUv).rgb;gl_FragColor=vec4(base.rgb+glow*0.22,max(base.a,min(1.0,max(glow.r,max(glow.g,glow.b))*0.22)));}',
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  override setSize(width: number, height: number) { this.composer.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2))); }
  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget) {
    const hidden: Object3D[] = [];
    const saved = new Map<Renderable, Material | Material[]>(), background = this.scene.background;
    const clearColor = renderer.getClearColor(new Color()), clearAlpha = renderer.getClearAlpha();
    try {
      this.scene.background = new Color(0x000000);
      this.scene.traverse(object => {
        if (object.userData.skipBloom && object.visible) { object.visible = false; hidden.push(object); }
        const drawable = object as Renderable;
        if (!drawable.material || isArc(object)) return;
        saved.set(drawable, drawable.material);
        drawable.material = drawable.isPoints ? this.blackPoints : drawable.isLine ? this.blackLine : this.blackMesh;
      });
      this.composer.render();
    } finally {
      hidden.forEach(object => { object.visible = true; });
      saved.forEach((material, object) => { object.material = material; });
      this.scene.background = background; renderer.setClearColor(clearColor, clearAlpha);
    }
    this.material.uniforms.baseTexture.value = readBuffer.texture;
    this.material.uniforms.glowTexture.value = this.composer.readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  override dispose() {
    this.bloom.dispose(); this.composer.dispose(); this.quad.dispose(); this.material.dispose();
    this.blackMesh.dispose(); this.blackPoints.dispose(); this.blackLine.dispose();
  }
}
