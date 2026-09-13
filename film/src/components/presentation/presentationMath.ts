export const YEAR_INVOICES = 12_029;
export const STRESS_OPERATIONS = 10_000;
export const STRESS_ACCEPTED = 7_002;
export const STRESS_REJECTED = 2_998;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** Stage 2: one exchange, a pause, then each token retraces its own half-circle. */
export const swapProgress = (elapsedSeconds: number) => {
  if (elapsedSeconds <= 0) return 0;
  if (elapsedSeconds < 0.75) return smooth(elapsedSeconds / 0.75);
  if (elapsedSeconds <= 1.1) return 1;
  return 1 - smooth(clamp((elapsedSeconds - 1.1) / 0.75));
};

export const swapPositions = (elapsedSeconds: number, cx = 351.3, cy = 775, radius = 151) => {
  const angle = Math.PI * swapProgress(elapsedSeconds);
  const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
  return [{x: cx - x, y: cy - y}, {x: cx + x, y: cy + y}];
};

/** The old interval stays unfilled: only newly added days earn the extension's yield. */
export const extensionState = (frame: number, startFrame: number, endFrame: number) => {
  const maturityDay = 30 + Math.round(60 * clamp((frame - startFrame) / Math.max(1, endFrame - startFrame)));
  return {maturityDay, addedDays: maturityDay - 30,
    ticks: Array.from({length: 90}, (_, day) => ({day, filled: day >= 30 && day < maturityDay}))};
};

export const illustrativeDate = (day: number) =>
  new Date(Date.UTC(2025, 8, 9 + day)).toISOString().slice(0, 10);
