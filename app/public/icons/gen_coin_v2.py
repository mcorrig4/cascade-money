#!/usr/bin/env python3
"""Cascade dated-dollar coin icon — v2, redrawn from Liam's sketch.

Sketch (Liam, msg 21904 attachment): white-ish coin face, thick blue ring,
"USD" bold italic light-blue inside, a LARGE pink "+" sitting ON the rim at
~4 o'clock overlapping the edge, the day count large grey to the RIGHT of the
plus on the same baseline (reads USD+90 left to right), the ISO date small
green ABOVE the number. Liam: keep proportions so the line above the big
number still feels good; small sizes may drop the date; the plus stays even
if it reads like a button.

Palette mapped to the app's actual dark-theme tokens (styles.css):
  ring        #548e7d  (--money-adjacent ring teal, existing .dated-coin ring)
  USD         #69e6c0  (--money)
  plus accent #e8b768  (existing amber used for the "extend" ledger dot /
                        director-warning — the only HUD accent color in the
                        app; stands in for the sketch's pink)
  number      #e9f2ee  (near-white)
  date        #8297a5  (--muted)
  dark face   #132531 -> #081319 (existing panel gradient)
  light face  #eef4f1 -> #c9d6d1 (candidate — sketch drew a white face)
"""
import math
import sys

FONT = "Inter, 'DejaVu Sans', Helvetica, Arial, sans-serif"

RING_TEAL = "#548e7d"
RING_DARK = "#102824"
MONEY = "#69e6c0"
MONEY_ON_LIGHT = "#0e7a5a"
ACCENT = "#e8b768"
NUMBER = "#e9f2ee"
DATE = "#8297a5"

FACE_DARK_HI, FACE_DARK_LO = "#132531", "#081319"
FACE_LIGHT_HI, FACE_LIGHT_LO = "#eef4f1", "#c9d6d1"

CX, CY, R = 100, 100, 78
PLUS_ANGLE = 118  # ~4 o'clock, clockwise from 12
PLUS_ARM, PLUS_THICK = 34, 20


def rim_point(angle_deg, radius=R):
    a = math.radians(angle_deg)
    return CX + radius * math.sin(a), CY - radius * math.cos(a)


def coin_svg(show_plus, days, iso_date, show_date=True, light=False, uid="coin"):
    face_hi, face_lo = (FACE_LIGHT_HI, FACE_LIGHT_LO) if light else (FACE_DARK_HI, FACE_DARK_LO)
    usd_color = MONEY_ON_LIGHT if light else MONEY
    bx, by = rim_point(PLUS_ANGLE)

    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 210">
  <defs>
    <radialGradient id="panel-{uid}" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stop-color="{face_hi}"/>
      <stop offset="100%" stop-color="{face_lo}"/>
    </radialGradient>
  </defs>
  <g font-family="{FONT}">
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{RING_DARK}" stroke-width="7"/>
    <circle cx="{CX}" cy="{CY}" r="{R-3.5}" fill="none" stroke="{RING_TEAL}" stroke-width="7"/>
    <circle cx="{CX}" cy="{CY}" r="{R-9}" fill="url(#panel-{uid})"/>
    <text x="{CX}" y="{CY+11}" text-anchor="middle" font-size="34" font-weight="700"
          font-style="italic" letter-spacing="1" fill="{usd_color}">USD</text>''']

    if show_plus:
        # Drawn plus (two rounded bars), large, centered on the rim point so it
        # overlaps the coin edge, per the sketch.
        parts.append(f'''
    <g transform="translate({bx:.2f} {by:.2f})">
      <rect x="{-PLUS_ARM}" y="{-PLUS_THICK/2}" width="{2*PLUS_ARM}" height="{PLUS_THICK}" rx="{PLUS_THICK/2}" fill="{ACCENT}"/>
      <rect x="{-PLUS_THICK/2}" y="{-PLUS_ARM}" width="{PLUS_THICK}" height="{2*PLUS_ARM}" rx="{PLUS_THICK/2}" fill="{ACCENT}"/>
    </g>''')

    if days is not None:
        num_baseline = by + 32
        num_x = bx + PLUS_ARM + 18
        parts.append(f'''
    <text x="{num_x:.2f}" y="{num_baseline:.2f}" font-size="94" font-weight="700" letter-spacing="-2"
          fill="{NUMBER}" font-variant-numeric="tabular-nums">{days}</text>''')
        if show_date and iso_date:
            date_baseline = num_baseline - 76
            parts.append(f'''
    <text x="{num_x:.2f}" y="{date_baseline:.2f}" font-size="26" font-weight="600" letter-spacing="1"
          fill="{DATE}" font-variant-numeric="tabular-nums">{iso_date}</text>''')
    elif show_date and iso_date:
        # spot: no plus/number, date sits centered under the coin
        parts.append(f'''
    <text x="{CX}" y="{CY+108}" text-anchor="middle" font-size="26" font-weight="600" letter-spacing="1"
          fill="{DATE}" font-variant-numeric="tabular-nums">{iso_date}</text>''')

    parts.append('\n  </g>\n</svg>\n')
    return ''.join(parts)


def coin_only_svg(show_plus, light=False, uid="coinonly"):
    """Coin roundel alone (no outside day-count/date) — for storyboard frames."""
    face_hi, face_lo = (FACE_LIGHT_HI, FACE_LIGHT_LO) if light else (FACE_DARK_HI, FACE_DARK_LO)
    usd_color = MONEY_ON_LIGHT if light else MONEY
    bx, by = rim_point(PLUS_ANGLE)
    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="panel-{uid}" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stop-color="{face_hi}"/>
      <stop offset="100%" stop-color="{face_lo}"/>
    </radialGradient>
  </defs>
  <g font-family="{FONT}">
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{RING_DARK}" stroke-width="7"/>
    <circle cx="{CX}" cy="{CY}" r="{R-3.5}" fill="none" stroke="{RING_TEAL}" stroke-width="7"/>
    <circle cx="{CX}" cy="{CY}" r="{R-9}" fill="url(#panel-{uid})"/>
    <text x="{CX}" y="{CY+11}" text-anchor="middle" font-size="34" font-weight="700"
          font-style="italic" letter-spacing="1" fill="{usd_color}">USD</text>''']
    if show_plus:
        parts.append(f'''
    <g transform="translate({bx:.2f} {by:.2f})">
      <rect x="{-PLUS_ARM}" y="{-PLUS_THICK/2}" width="{2*PLUS_ARM}" height="{PLUS_THICK}" rx="{PLUS_THICK/2}" fill="{ACCENT}"/>
      <rect x="{-PLUS_THICK/2}" y="{-PLUS_ARM}" width="{PLUS_THICK}" height="{2*PLUS_ARM}" rx="{PLUS_THICK/2}" fill="{ACCENT}"/>
    </g>''')
    parts.append('\n  </g>\n</svg>\n')
    return ''.join(parts)


VARIANTS = {
    "spot": dict(show_plus=False, days=None, iso_date="2026-09-13"),
    "p30":  dict(show_plus=True,  days=30,   iso_date="2026-10-13"),
    "p60":  dict(show_plus=True,  days=60,   iso_date="2026-11-12"),
    "p90":  dict(show_plus=True,  days=90,   iso_date="2026-12-12"),
}

if __name__ == "__main__":
    name = sys.argv[1]
    light = "--light" in sys.argv
    show_date = "--no-date" not in sys.argv
    v = VARIANTS[name]
    sys.stdout.write(coin_svg(uid=name + ("-light" if light else "-dark"), light=light,
                               show_date=show_date, **v))
