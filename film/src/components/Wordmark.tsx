/**
 * The Cascade Money wordmark + mark — copied verbatim from the app:
 *   icon: ~/code/cascade/app/public/mark.svg (48x48, #071019 bg, 3-bar glyph
 *         stroked in the money teal #69e6c0)
 *   type: .brand rule in app/src/styles.css — 37px/550/-1.8px letter-spacing,
 *         "cascade" + a teal "." (brand-dot)
 * `size` scales both proportionally; `full` renders "Cascade Money" (the end
 * card's wordmark) instead of the app's own in-product "cascade." lockup.
 */
import React from 'react';
import {color} from '../brand/tokens';

export const CascadeMark: React.FC<{size?: number}> = ({size = 48}) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <rect width="48" height="48" rx="12" fill={color.bgOuter} />
    <g fill="none" stroke={color.money} strokeWidth={4} strokeLinecap="round">
      <path d="M12 14h24M12 24h17M12 34h10" />
    </g>
  </svg>
);

export const Wordmark: React.FC<{
  size?: number;
  full?: boolean;
  dark?: boolean;
  style?: React.CSSProperties;
}> = ({size = 96, full = false, dark = false, style}) => {
  const fg = dark ? color.bgOuter : color.fg;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.22,
        fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
        fontWeight: 550,
        fontSize: size,
        letterSpacing: size * -0.048,
        color: fg,
        ...style,
      }}
    >
      <CascadeMark size={size * 0.78} />
      <span>
        {full ? 'Cascade Money' : 'cascade'}
        <span style={{color: color.money}}>.</span>
      </span>
    </div>
  );
};
