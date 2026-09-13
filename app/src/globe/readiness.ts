import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';
/** A render generation owns its gate; disposal never releases a partial frame. */
export class RenderReadiness {
  readonly promise: Promise<void>;
  complete = false;
  private failed = false;
  private resolve!: () => void;
  private reject!: (reason: Error) => void;
  private deadline?: ReturnType<typeof setTimeout>;
  constructor(timeoutMs = 0) {
    this.promise = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    // A failed startup is also reported by the scene; ready() still rejects for callers.
    void this.promise.catch(() => {});
    if(timeoutMs>0)this.deadline=setTimeout(()=>this.fail(new Error('Earth readiness timed out')),timeoutMs);
  }
  finish() { if(!this.failed) { clearTimeout(this.deadline); this.complete = true; this.resolve(); } }
  fail(reason: Error) { if (!this.complete) { clearTimeout(this.deadline); this.failed = true; this.reject(reason); } }
}
export const EARTH_BACKGROUND = '#071019';

/** Rendering compiles the current materials synchronously. Do not poll a material
 * snapshot with compileAsync: globe.gl can retire its materials between polls,
 * and Three r183's timer then throws on an absent currentProgram without rejecting.
 */
export function finishFirstFrame(render:()=>void, context:Pick<WebGLRenderingContext,'isContextLost'|'finish'>) {
  if(context.isContextLost())throw new Error('WebGL context lost before the first Earth frame');
  render();
  context.finish();
  if(context.isContextLost())throw new Error('WebGL context lost during the first Earth frame');
}

/** Synchronous barrier for stable site assets, including invisible/out-of-frustum markers.
 * compile() traverses hidden meshes too; avoid the retiring-material compileAsync poller.
 */
export function compileSiteMaterials(renderer: WebGLRenderer, root: Object3D, camera: Camera, scene: Scene) {
  const previous = renderer.debug.onShaderError;
  renderer.debug.onShaderError = () => { throw new Error('Site material compilation failed'); };
  try { finishFirstFrame(() => { renderer.compile(root, camera, scene); }, renderer.getContext()); }
  finally { renderer.debug.onShaderError = previous; }
}
