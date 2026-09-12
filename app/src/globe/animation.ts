export const GROUND_RADIUS_KM = 6371;
export const DASH_KM = 90;
export const GAP_KM = 60;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
export function arcLifecycle(age: number, life: number) {
  const progress = clamp(age / life);
  return {
    progress,
    clipStart: smooth((progress - 0.65) / 0.35),
    clipEnd: smooth(progress / 0.32),
    alpha: clamp(age / Math.min(100, life * 0.15)) * (1 - smooth((progress - 0.65) / 0.35)),
    // Subtract this from the ground distance in the shader: patterns move toward the payee.
    phaseKm: progress * 1350,
  };
}
export function pickup(age: number, life: number) {
  const p = clamp(age / life);
  const burst = p < 0.09 ? 0.65 + 0.57 * smooth(p / 0.09) : p < 0.2 ? 1.22 - 0.22 * smooth((p - 0.09) / 0.11) : 1 + 0.15 * smooth((p - 0.55) / 0.45);
  return { scale: burst, rise: p * Math.min(60, life * 0.03), alpha: smooth(p / 0.07) * (1 - smooth((p - 0.65) / 0.35)) };
}
export const arcLifetime = (rate: number, proof: boolean) => proof ? 3500 : Math.max(320, 1800 / Math.max(1, rate));
/** Continuous month-scale sun; limit catch-up after long/dropped frames to prevent flashes. */
export class SunClock {
  phase = 0;
  private previous: number | undefined;
  private target = 0;
  update(position: number, elapsedMs: number, held: boolean) {
    if (this.previous === undefined) { this.previous = position; this.phase = position; this.target = position; }
    const delta = position - this.previous; this.previous = position;
    if (held || delta < 0) this.target = this.phase;
    else { this.target += delta; this.phase += Math.min(this.target - this.phase, 365 / 15 * Math.min(elapsedMs, 50) / 1000); }
    return { lng: -150 - this.phase * 360 / 30, lat: 23.44 * Math.sin(2 * Math.PI * (this.phase + 172) / 365) };
  }
}
/** Wall-clock motion remains independent of playback speed and pause state. */
export class IdleMotion {
  seconds=0;
  update(elapsedMs:number, altitude:number, blocked:boolean, featured=false) {
    if(blocked)return {lng:0,lat:0,altitude:0,orbit:0};
    const before=this.seconds, dt=Math.min(Math.max(elapsedMs,0),100)/1000; this.seconds+=dt;
    const wave=(period:number)=>Math.sin(this.seconds/period)-Math.sin(before/period);
    return {lng:dt*.4,lat:wave(12)*.6,
      altitude:wave(9)*Math.min(featured?.08:.025,Math.max(0,altitude)*.02),orbit:Math.sin(this.seconds/12)*.3};
  }
}
