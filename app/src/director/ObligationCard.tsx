import { displayDate, type Event, type EventIndex } from '../data/types.ts';
import { dollars } from '../data/format.ts';
import { logoFor } from '../globe/brands.ts';
import { narratedOrder } from './shots.ts';
import { cueMs, entrance } from './cues.ts';
import type { PlaybackState } from '../playback/engine.ts';

/**
 * Scene 3's closing beat — the last third of "The hidden supply chain".
 *
 * The narration there stops describing the chain and states the position every
 * firm in it is holding: "A display maker has money coming from Apple, but it
 * owes the glass maker. The glass maker has suppliers to pay today. Incoming
 * value is only useful if it can meet the next obligation."
 *
 * Two rows, one per company, sharing two columns — MONEY COMING IN and MONEY
 * OWED. The columns are the whole point: they repeat, so the reader sees at a
 * glance that the left column is always a date months out and the right column
 * is always now. Nothing here is a timeline to interpret, and nothing is
 * positioned by time; the dates are just typed, side by side.
 *
 * Every amount and incoming date is read from the indexed run — the same
 * narrated story beats the globe is drawing (`display` = Apple's order,
 * `cover-glass` = Samsung Display's order, `silica` + `chemicals` = Corning's
 * two supplier bills). The only authored strings are the column headings and
 * the "Today" the narration itself speaks.
 *
 * Beats are keyed to the recorded take through the shared cue map (film's
 * cues.ts resolves each phrase to a word timestamp; the seconds below are the
 * measured fallbacks for a standalone app run):
 *   money-waits    19.77  the card frame and its two column headings
 *   display-maker  21.57  row 1, incoming
 *   owes-glass     24.33  row 1, owed
 *   glass-maker    25.59  row 2, incoming
 *   pay-today      26.67  row 2, owed
 *   incoming-value 29.29  the closing line, on the line it quotes
 */

const FADE_MS = 420;

type Column = { amount: string; detail: string; when: string; now?: boolean };
type Row = { firm: string; role: string; logo?: string; incoming: Column; owed: Column };

const maturityOf = (event?: Event): number | null => {
  const value = event?.data.mint_date ?? event?.data.accepted_maturity ?? event?.dates?.at(-1);
  return typeof value === 'number' ? value : null;
};

/** Short form, matching the ledger's own date column ("Dec 8"), so a cell never wraps. */
const dueDate = (event?: Event): string => {
  const day = maturityOf(event);
  return day === null ? '' : displayDate(day, true);
};

/** The two firms the narration names, built from the story beats already on screen. */
export function obligationRows(index: EventIndex): Row[] {
  const order = narratedOrder(index, 'display');
  const coverGlass = narratedOrder(index, 'cover-glass');
  const silica = narratedOrder(index, 'silica');
  const chemicals = narratedOrder(index, 'chemicals');
  if (!order || !coverGlass) return [];
  const corningOwes = [silica, chemicals].filter(Boolean) as Event[];
  const corningTotal = corningOwes.reduce((sum, event) => sum + event.amount, 0n);
  return [
    {
      firm: coverGlass.from ?? 'Samsung Display',
      role: 'display maker',
      logo: logoFor(coverGlass.from ?? ''),
      incoming: { amount: dollars(order.amount, true), detail: `from ${order.from}`, when: dueDate(order) },
      owed: { amount: dollars(coverGlass.amount, true), detail: `to ${coverGlass.to}`, when: 'Today', now: true },
    },
    ...(corningOwes.length
      ? [{
          firm: coverGlass.to ?? 'Corning',
          role: 'glass maker',
          logo: logoFor(coverGlass.to ?? ''),
          incoming: { amount: dollars(coverGlass.amount, true), detail: `from ${coverGlass.from}`, when: dueDate(coverGlass) },
          owed: {
            amount: dollars(corningTotal, true),
            detail: `to ${corningOwes.length} suppliers`,
            when: 'Today',
            now: true,
          },
        }]
      : []),
  ];
}

const logoSrc = (slug: string) => {
  const base = window.__cascade?.frameDriven
    ? `${(window as typeof window & { remotion_staticBase?: string }).remotion_staticBase ?? ''}/`
    : '/';
  return `${base}logos/${slug}.svg`;
};

/**
 * Decode the card's wordmarks the moment this module loads, long before the card
 * itself mounts two-thirds of the way through the scene. A frame-driven render
 * screenshots whatever is painted at that instant: an <img> that is still
 * decoding drops its mark for those frames, and the film's renderer runs several
 * browser tabs, so it shows up as a wordmark that flickers out for a few frames
 * in the middle of a held card. Warming the decode here removes the race.
 */
const warmed = new Set<string>();
export function warmLogos(slugs: (string | undefined)[]) {
  for (const slug of slugs) {
    if (!slug || warmed.has(slug)) continue;
    warmed.add(slug);
    const image = new Image();
    image.src = logoSrc(slug);
    void image.decode().catch(() => {});
  }
}

function Cell({ column, alpha }: { column: Column; alpha: number }) {
  if (alpha <= 0) return null;
  return (
    <div className={`obligation-cell${column.now ? ' obligation-now' : ''}`} style={{ opacity: alpha, transform: `translateY(${(1 - alpha) * 8}px)` }}>
      <strong>{column.amount}</strong>
      <span>{column.detail}</span>
      <em>{column.when}</em>
    </div>
  );
}

export function ObligationCard({ engine, state }: { engine: { index: EventIndex }; state: PlaybackState }) {
  // Resolved (and the wordmarks warmed) on every frame from the app's first one,
  // not at the card's own entrance twenty seconds in — see warmLogos.
  const rows = obligationRows(engine.index);
  warmLogos(rows.map(row => row.logo));
  if (state.shot !== 3 || state.shotElapsed < 0 || !rows.length) return null;
  const tMs = state.shotElapsed * 1000;
  const at = (name: string, seconds: number) => cueMs(state, name, seconds, 20.2);
  const alpha = (name: string, seconds: number) => entrance(tMs, at(name, seconds), FADE_MS);
  const card = alpha('money-waits', 19.77);
  if (card <= 0) return null;
  const rowAlpha = [
    { incoming: alpha('display-maker', 21.57), owed: alpha('owes-glass', 24.33) },
    { incoming: alpha('glass-maker', 25.59), owed: alpha('pay-today', 26.67) },
  ];
  const closing = alpha('incoming-value', 29.29);
  return (
    <section className="obligation-card" aria-label="What each company in the chain is holding" style={{ opacity: card, transform: `translateY(${(1 - card) * 14}px)` }}>
      <header>
        <span className="eyebrow">THE SAME WEEK</span>
        <div className="obligation-heads">
          <span>MONEY COMING IN</span>
          <span>MONEY OWED</span>
        </div>
      </header>
      {rows.map((row, index) => {
        const visible = Math.max(rowAlpha[index]?.incoming ?? 0, rowAlpha[index]?.owed ?? 0);
        if (visible <= 0) return null;
        return (
          <div className="obligation-row" key={row.firm} style={{ opacity: visible }}>
            <div className="obligation-firm">
              {/* The brand files are wordmarks, not square marks (public/logos/*.svg,
                  the same files the globe's company layer draws), so the logo stands
                  IN for the name rather than sitting beside it — a 44px square would
                  squash "SAMSUNG" to a hairline. Firms without a licensed mark keep
                  their typeset name. */}
              {row.logo
                ? <img className="obligation-wordmark" src={logoSrc(row.logo)} alt={row.firm} />
                : <strong>{row.firm}</strong>}
              <span>{row.role}</span>
            </div>
            <Cell column={row.incoming} alpha={rowAlpha[index]?.incoming ?? 0} />
            <Cell column={row.owed} alpha={rowAlpha[index]?.owed ?? 0} />
          </div>
        );
      })}
      {closing > 0 && (
        <p className="obligation-close" style={{ opacity: closing, transform: `translateY(${(1 - closing) * 8}px)` }}>
          Incoming value is only useful if it can meet the next obligation.
        </p>
      )}
    </section>
  );
}
