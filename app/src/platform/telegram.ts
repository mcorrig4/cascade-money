export interface Insets { top?: number; right?: number; bottom?: number; left?: number }
export interface TelegramApp {
  ready?: () => void; expand?: () => void; disableVerticalSwipes?: () => void;
  safeAreaInset?: Insets; contentSafeAreaInset?: Insets;
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
}
export function safeInsets(app: TelegramApp): Required<Insets> {
  const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : 0;
  return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side,
    Math.max(valid(app.safeAreaInset?.[side as keyof Insets]), valid(app.contentSafeAreaInset?.[side as keyof Insets])),
  ])) as Required<Insets>;
}
/** No SDK download or theme override. Ordinary Telegram browser tabs may have no bridge. */
export function initializeTelegram(app: TelegramApp | undefined, root: HTMLElement) {
  if (!app) return () => {};
  for (const method of ['ready', 'expand', 'disableVerticalSwipes'] as const) {
    try { app[method]?.(); } catch { /* Older clients can expose unsupported methods. */ }
  }
  const update = () => Object.entries(safeInsets(app)).forEach(([side, value]) => root.style.setProperty(`--telegram-safe-${side}`, `${value}px`));
  update();
  const events = ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged'];
  events.forEach(event => app.onEvent?.(event, update));
  return () => { events.forEach(event => app.offEvent?.(event, update)); Object.keys(safeInsets(app)).forEach(side => root.style.removeProperty(`--telegram-safe-${side}`)); };
}
