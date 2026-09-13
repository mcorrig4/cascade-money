#!/usr/bin/env python3
"""Cascade dated-dollar coin icon — v3, per Liam's seven notes on the v2 sheet
(msg 22232, on the v2 sheet 22224):

1. Shrink the big number a little.
2. Plus stroke matches the coin's border-ring thickness; plus is smaller overall.
3. Date uses a narrower, more horizontally condensed treatment.
4. More gap between the top of the big number and the bottom of the date.
5. Date is centred above the big number (no more left hang).
6. The spot token (no maturity) gets the plus too, reading "+0" — same layout.
7. USD lettering and the border are unchanged ("it kind of looks good how it is").

Geometry constants below are the ONLY thing that changed from v2 in the number/
plus/date block; the two-ring border and the USD wordmark keep v2's numbers.

Palette is now a parameter (colourways brief, msg 22233): PALETTES holds four
named palettes; the app stays on palette "A" (current) until Liam picks one.
"""
import math
import sys

FONT = "Inter, 'DejaVu Sans', Helvetica, Arial, sans-serif"
DATE_FONT = "'Inter Condensed', 'Roboto Condensed', 'Arial Narrow', Inter, 'DejaVu Sans', sans-serif"

CX, CY, R = 100, 100, 78
RING_STROKE = 7          # coin's border-ring thickness (both rings) — unchanged from v2, note 7
RING_GAP = 3.5           # inner ring radius offset — unchanged from v2

PLUS_ANGLE = 118  # ~4 o'clock, clockwise from 12 — unchanged
PLUS_ARM, PLUS_THICK = 22, RING_STROKE   # note 2: smaller overall; stroke == ring thickness
PLUS_RX = PLUS_THICK / 2

NUMBER_SIZE = 82          # note 1: was 94 in v2
NUMBER_LETTER_SPACING = -2
NUM_DIGIT_WIDTH = NUMBER_SIZE * 0.62   # tabular-nums approx digit advance, bold

DATE_SIZE = 26
DATE_CONDENSE = 0.82       # note 3: horizontal squeeze applied via transform (font-stretch alone
                           # is not reliably honored without a real condensed face installed)
DATE_GAP_FROM_NUM_BASELINE = 84  # note 4: was 76 in v2; number top moves further from date bottom
                                  # both because this grew AND because the number itself shrank


def rim_point(angle_deg, radius=R):
    a = math.radians(angle_deg)
    return CX + radius * math.sin(a), CY - radius * math.cos(a)


def darken(hex_color, amount=0.18):
    hex_color = hex_color.lstrip('#')
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    r, g, b = (max(0, int(c * (1 - amount))) for c in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


# Palette contract: face (single base colour; a subtly darkened tone is used for the
# radial gradient's outer stop), ring, plus, number, date, usd. The outer hairline
# ring is a darkened version of `ring` (keeps v2's two-tone border read).
PALETTES = {
    "A": dict(name="Current", face="#eef4f1", face_lo="#c9d6d1", ring="#548e7d",
               ring_dark="#102824", plus="#e8b768", number="#e9f2ee", date="#8297a5", usd="#0e7a5a"),
    "B": dict(name="Glacier enamel", face="#DDF8F3", ring="#43D9C0", plus="#43D9C0",
               number="#F4FFFC", date="#A8C6CE", usd="#103B37"),
    "C": dict(name="Porcelain and vermilion", face="#FFF2DF", ring="#E9CDA7", plus="#FF735E",
               number="#FF735E", date="#C3B8AC", usd="#263B40"),
    "D": dict(name="Midnight and electric lilac", face="#202B43", ring="#B7A2FF", plus="#CCBAFF",
               number="#F1EAFF", date="#B1BBD0", usd="#F1EAFF"),
}


DARK_FACE_HI, DARK_FACE_LO, DARK_USD = "#132531", "#081319", "#69e6c0"


def resolve_palette(key, dark=False):
    p = dict(PALETTES[key])
    p.setdefault("face_lo", darken(p["face"], 0.12))
    p.setdefault("ring_dark", darken(p["ring"], 0.55))
    if dark:
        p["face"], p["face_lo"], p["usd"] = DARK_FACE_HI, DARK_FACE_LO, DARK_USD
    return p


def date_x_center(num_x, digits):
    return num_x + (NUM_DIGIT_WIDTH * digits) / 2.0


def coin_svg(show_plus, days, iso_date, show_date=True, palette="A", dark=False, uid="coin"):
    pal = resolve_palette(palette, dark=dark)
    bx, by = rim_point(PLUS_ANGLE)

    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 210">
  <defs>
    <radialGradient id="panel-{uid}" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stop-color="{pal['face']}"/>
      <stop offset="100%" stop-color="{pal['face_lo']}"/>
    </radialGradient>
  </defs>
  <g font-family="{FONT}">
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{pal['ring_dark']}" stroke-width="{RING_STROKE}"/>
    <circle cx="{CX}" cy="{CY}" r="{R-RING_GAP}" fill="none" stroke="{pal['ring']}" stroke-width="{RING_STROKE}"/>
    <circle cx="{CX}" cy="{CY}" r="{R-9}" fill="url(#panel-{uid})"/>
    <text x="{CX}" y="{CY+11}" text-anchor="middle" font-size="34" font-weight="700"
          font-style="italic" letter-spacing="1" fill="{pal['usd']}">USD</text>''']

    # note 6: spot (no maturity) still gets the plus + "0", same layout as every other coin.
    render_days = 0 if days is None else days
    if show_plus:
        parts.append(f'''
    <g transform="translate({bx:.2f} {by:.2f})">
      <rect x="{-PLUS_ARM}" y="{-PLUS_THICK/2}" width="{2*PLUS_ARM}" height="{PLUS_THICK}" rx="{PLUS_RX}" fill="{pal['plus']}"/>
      <rect x="{-PLUS_THICK/2}" y="{-PLUS_ARM}" width="{PLUS_THICK}" height="{2*PLUS_ARM}" rx="{PLUS_RX}" fill="{pal['plus']}"/>
    </g>''')

    num_baseline = by + 32
    num_x = bx + PLUS_ARM + 18
    parts.append(f'''
    <text x="{num_x:.2f}" y="{num_baseline:.2f}" font-size="{NUMBER_SIZE}" font-weight="700" letter-spacing="{NUMBER_LETTER_SPACING}"
          fill="{pal['number']}" font-variant-numeric="tabular-nums">{render_days}</text>''')

    if show_date and iso_date:
        digits = len(str(render_days))
        cx_date = date_x_center(num_x, digits)
        date_baseline = num_baseline - DATE_GAP_FROM_NUM_BASELINE
        inv = 1 / DATE_CONDENSE
        # note 3 (condensed) + note 5 (centred): squeeze horizontally about cx_date,
        # text-anchor=middle keeps it centred over the number regardless of digit count.
        parts.append(f'''
    <g transform="translate({cx_date:.2f} {date_baseline:.2f}) scale({DATE_CONDENSE} 1)">
      <text x="0" y="0" text-anchor="middle" font-family="{DATE_FONT}" font-stretch="condensed"
            font-size="{DATE_SIZE}" font-weight="600" letter-spacing="0.5"
            fill="{pal['date']}" font-variant-numeric="tabular-nums">{iso_date}</text>
    </g>''')

    parts.append('\n  </g>\n</svg>\n')
    return ''.join(parts)


VARIANTS = {
    "spot": dict(show_plus=True, days=None, iso_date="2026-09-13"),
    "p30":  dict(show_plus=True, days=30,   iso_date="2026-10-13"),
    "p60":  dict(show_plus=True, days=60,   iso_date="2026-11-12"),
    "p90":  dict(show_plus=True, days=90,   iso_date="2026-12-12"),
}

if __name__ == "__main__":
    name = sys.argv[1]
    palette = "A"
    for a in sys.argv[2:]:
        if a.startswith("--palette="):
            palette = a.split("=", 1)[1]
    show_date = "--no-date" not in sys.argv
    dark = "--dark" in sys.argv
    v = VARIANTS[name]
    sys.stdout.write(coin_svg(uid=f"{name}-{palette}{'-dark' if dark else ''}", palette=palette,
                               dark=dark, show_date=show_date, **v))
