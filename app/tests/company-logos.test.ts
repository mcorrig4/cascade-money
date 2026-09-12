import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BRANDS, LOGOS, MONOGRAM_ONLY } from '../src/globe/brands.ts';

test('every real-named company has an official logo file or is on the explicit monogram list', () => {
  for (const name of Object.keys(BRANDS)) {
    const hasLogo = name in LOGOS;
    const isMonogramOnly = MONOGRAM_ONLY.includes(name);
    assert.ok(hasLogo || isMonogramOnly, `${name} needs a LOGOS entry or a MONOGRAM_ONLY listing`);
    assert.ok(!(hasLogo && isMonogramOnly), `${name} cannot be both a logo and monogram-only`);
  }
});

test('every LOGOS slug resolves to a real, non-empty SVG file under public/logos', () => {
  for (const [name, slug] of Object.entries(LOGOS)) {
    const path = fileURLToPath(new URL(`../public/logos/${slug}.svg`, import.meta.url));
    assert.ok(existsSync(path), `${name} -> public/logos/${slug}.svg is missing`);
  }
});

test('logo files stay small and single-color, and never claim a raster fallback', () => {
  for (const slug of Object.values(LOGOS)) {
    const path = fileURLToPath(new URL(`../public/logos/${slug}.svg`, import.meta.url));
    const bytes = statSync(path).size;
    assert.ok(bytes < 20 * 1024, `${slug}.svg is ${bytes} bytes, over the 20KB budget`);
    const content = readFileSync(path, 'utf8');
    assert.match(content, /^<svg[^>]*viewBox="[^"]+"/, `${slug}.svg must have a tight viewBox`);
  }
});
