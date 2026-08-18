// Paint matching - turning "#EDE7DA Chalk" into something you can buy.
//
// ── An honest note about the data ──────────────────────────────────────────
// The names and codes below are real, widely published products. The hex values
// are NOT manufacturer colorimetric data; they are the commonly circulated
// screen approximations. A paint's appearance depends on its finish, the light
// in the room, and the substrate, and no hex triplet survives that journey.
//
// So this feature is deliberately framed as "closest matches, go get a sample",
// never as "this is the colour". Every response carries `disclaimer`, the UI
// prints it next to the results, and matches beyond a visible distance are
// labelled as approximate rather than quietly presented as exact.
//
// To swap in licensed colorimetric data later, replace PAINTS - nothing else
// changes.

import { deltaE2000, hexToLab } from './color.js';

export const DISCLAIMER =
  'Closest matches by screen colour. Paint shifts with finish, light, and ' +
  'substrate - always check a physical sample in the room before buying.';

/**
 * Curated across four widely stocked ranges. Kept deliberately tight: a short
 * list of colours people can actually walk into a shop and find beats a long
 * list padded with discontinued shades.
 */
const PAINTS = [
  // ── Farrow & Ball ────────────────────────────────────────────────────────
  { brand: 'Farrow & Ball', name: 'All White', code: 'No.2005', hex: '#f6f4ef' },
  { brand: 'Farrow & Ball', name: 'Pointing', code: 'No.2003', hex: '#f4efe3' },
  { brand: 'Farrow & Ball', name: 'Wimborne White', code: 'No.239', hex: '#f3eee1' },
  { brand: 'Farrow & Ball', name: 'Slipper Satin', code: 'No.2004', hex: '#eeeade' },
  { brand: 'Farrow & Ball', name: 'School House White', code: 'No.291', hex: '#ece5d3' },
  { brand: 'Farrow & Ball', name: 'Shaded White', code: 'No.201', hex: '#dcd7c6' },
  { brand: 'Farrow & Ball', name: 'Skimming Stone', code: 'No.241', hex: '#dfd8cd' },
  { brand: 'Farrow & Ball', name: 'Ammonite', code: 'No.274', hex: '#d5d1c8' },
  { brand: 'Farrow & Ball', name: 'Cornforth White', code: 'No.228', hex: '#d3cec6' },
  { brand: 'Farrow & Ball', name: "Elephant's Breath", code: 'No.229', hex: '#cec4b8' },
  { brand: 'Farrow & Ball', name: 'Purbeck Stone', code: 'No.275', hex: '#c8c3b6' },
  { brand: 'Farrow & Ball', name: 'Setting Plaster', code: 'No.231', hex: '#e3c8b9' },
  { brand: 'Farrow & Ball', name: 'Pink Ground', code: 'No.202', hex: '#efd9cb' },
  { brand: 'Farrow & Ball', name: 'Dead Salmon', code: 'No.28', hex: '#b8a294' },
  { brand: 'Farrow & Ball', name: "Mole's Breath", code: 'No.276', hex: '#9d9a94' },
  { brand: 'Farrow & Ball', name: 'Borrowed Light', code: 'No.235', hex: '#dee5e5' },
  { brand: 'Farrow & Ball', name: 'Lulworth Blue', code: 'No.89', hex: '#a7bdd0' },
  { brand: 'Farrow & Ball', name: 'Oval Room Blue', code: 'No.85', hex: '#6d7f83' },
  { brand: 'Farrow & Ball', name: 'Treron', code: 'No.292', hex: '#6e6f60' },
  { brand: 'Farrow & Ball', name: 'Green Smoke', code: 'No.47', hex: '#5c6a63' },
  { brand: 'Farrow & Ball', name: 'Card Room Green', code: 'No.79', hex: '#666a5e' },
  { brand: 'Farrow & Ball', name: 'De Nimes', code: 'No.299', hex: '#6c7f8b' },
  { brand: 'Farrow & Ball', name: 'Inchyra Blue', code: 'No.289', hex: '#4c5a5c' },
  { brand: 'Farrow & Ball', name: 'Down Pipe', code: 'No.26', hex: '#5c6062' },
  { brand: 'Farrow & Ball', name: 'Studio Green', code: 'No.93', hex: '#313834' },
  { brand: 'Farrow & Ball', name: 'Stiffkey Blue', code: 'No.281', hex: '#3c4652' },
  { brand: 'Farrow & Ball', name: 'Hague Blue', code: 'No.30', hex: '#333f48' },
  { brand: 'Farrow & Ball', name: 'Railings', code: 'No.31', hex: '#43454a' },
  { brand: 'Farrow & Ball', name: 'Off-Black', code: 'No.57', hex: '#39393a' },
  { brand: 'Farrow & Ball', name: 'India Yellow', code: 'No.66', hex: '#c69a54' },
  { brand: 'Farrow & Ball', name: 'Babouche', code: 'No.223', hex: '#eabd58' },

  // ── Benjamin Moore ───────────────────────────────────────────────────────
  { brand: 'Benjamin Moore', name: 'Chantilly Lace', code: 'OC-65', hex: '#f4f4f0' },
  { brand: 'Benjamin Moore', name: 'Simply White', code: 'OC-117', hex: '#f5f1e4' },
  { brand: 'Benjamin Moore', name: 'White Dove', code: 'OC-17', hex: '#f0ede3' },
  { brand: 'Benjamin Moore', name: 'Cloud White', code: 'OC-130', hex: '#f2eee2' },
  { brand: 'Benjamin Moore', name: 'Swiss Coffee', code: 'OC-45', hex: '#ede8dc' },
  { brand: 'Benjamin Moore', name: 'Pale Oak', code: 'OC-20', hex: '#e0d9d0' },
  { brand: 'Benjamin Moore', name: 'Balboa Mist', code: 'OC-27', hex: '#d9d3c9' },
  { brand: 'Benjamin Moore', name: 'Classic Gray', code: 'OC-23', hex: '#e4e0d7' },
  { brand: 'Benjamin Moore', name: 'Edgecomb Gray', code: 'HC-173', hex: '#d5cec1' },
  { brand: 'Benjamin Moore', name: 'Revere Pewter', code: 'HC-172', hex: '#ccc5b6' },
  { brand: 'Benjamin Moore', name: 'Gray Owl', code: 'OC-52', hex: '#d3d5cd' },
  { brand: 'Benjamin Moore', name: 'Palladian Blue', code: 'HC-144', hex: '#c0d1c8' },
  { brand: 'Benjamin Moore', name: 'Wythe Blue', code: 'HC-143', hex: '#a5bfb3' },
  { brand: 'Benjamin Moore', name: 'Chelsea Gray', code: 'HC-168', hex: '#8b857a' },
  { brand: 'Benjamin Moore', name: 'Kendall Charcoal', code: 'HC-166', hex: '#6d6a63' },
  { brand: 'Benjamin Moore', name: 'Hale Navy', code: 'HC-154', hex: '#434c53' },
  { brand: 'Benjamin Moore', name: 'Newburyport Blue', code: 'HC-155', hex: '#3c4a58' },
  { brand: 'Benjamin Moore', name: 'Van Deusen Blue', code: 'HC-156', hex: '#455767' },
  { brand: 'Benjamin Moore', name: 'Black Forest Green', code: '2047-10', hex: '#31413c' },
  { brand: 'Benjamin Moore', name: 'Salamander', code: '2050-10', hex: '#333c39' },
  { brand: 'Benjamin Moore', name: 'Wrought Iron', code: '2124-10', hex: '#4a4c4a' },

  // ── Sherwin-Williams ─────────────────────────────────────────────────────
  { brand: 'Sherwin-Williams', name: 'Pure White', code: 'SW 7005', hex: '#eeece4' },
  { brand: 'Sherwin-Williams', name: 'Alabaster', code: 'SW 7008', hex: '#eee9e0' },
  { brand: 'Sherwin-Williams', name: 'Snowbound', code: 'SW 7004', hex: '#ebe7e1' },
  { brand: 'Sherwin-Williams', name: 'Shoji White', code: 'SW 7042', hex: '#e2dbd0' },
  { brand: 'Sherwin-Williams', name: 'Accessible Beige', code: 'SW 7036', hex: '#d1c7b8' },
  { brand: 'Sherwin-Williams', name: 'Agreeable Gray', code: 'SW 7029', hex: '#d1c7bb' },
  { brand: 'Sherwin-Williams', name: 'Repose Gray', code: 'SW 7015', hex: '#ccc9c1' },
  { brand: 'Sherwin-Williams', name: 'Anew Gray', code: 'SW 7030', hex: '#c5bcae' },
  { brand: 'Sherwin-Williams', name: 'Mindful Gray', code: 'SW 7016', hex: '#bcb7ad' },
  { brand: 'Sherwin-Williams', name: 'Worldly Gray', code: 'SW 7043', hex: '#c2b9a9' },
  { brand: 'Sherwin-Williams', name: 'Sea Salt', code: 'SW 6204', hex: '#cdd3ca' },
  { brand: 'Sherwin-Williams', name: 'Rainwashed', code: 'SW 6211', hex: '#c5d2c9' },
  { brand: 'Sherwin-Williams', name: 'Evergreen Fog', code: 'SW 9130', hex: '#95998d' },
  { brand: 'Sherwin-Williams', name: 'Dovetail', code: 'SW 7018', hex: '#918b85' },
  { brand: 'Sherwin-Williams', name: 'Peppercorn', code: 'SW 7674', hex: '#5c5c5c' },
  { brand: 'Sherwin-Williams', name: 'Urbane Bronze', code: 'SW 7048', hex: '#54524d' },
  { brand: 'Sherwin-Williams', name: 'Iron Ore', code: 'SW 7069', hex: '#434341' },
  { brand: 'Sherwin-Williams', name: 'Naval', code: 'SW 6244', hex: '#3b4a5a' },
  { brand: 'Sherwin-Williams', name: 'Tricorn Black', code: 'SW 6258', hex: '#2f2f30' },

  // ── Dulux ────────────────────────────────────────────────────────────────
  { brand: 'Dulux', name: 'Pure Brilliant White', code: '', hex: '#f7f7f4' },
  { brand: 'Dulux', name: 'Timeless', code: '', hex: '#eae3d7' },
  { brand: 'Dulux', name: 'Egyptian Cotton', code: '', hex: '#e6ddd0' },
  { brand: 'Dulux', name: 'Natural Hessian', code: '', hex: '#ded2bf' },
  { brand: 'Dulux', name: 'Nutmeg White', code: '', hex: '#e6dbcb' },
  { brand: 'Dulux', name: 'Brave Ground', code: '', hex: '#bcae9b' },
  { brand: 'Dulux', name: 'Wild Wonder', code: '', hex: '#ded1a5' },
  { brand: 'Dulux', name: 'Goose Down', code: '', hex: '#ddd8cd' },
  { brand: 'Dulux', name: 'Polished Pebble', code: '', hex: '#c8c8c1' },
  { brand: 'Dulux', name: 'Chic Shadow', code: '', hex: '#a8a8a4' },
  { brand: 'Dulux', name: 'Warm Pewter', code: '', hex: '#8d8577' },
  { brand: 'Dulux', name: 'Tranquil Dawn', code: '', hex: '#d3ddd4' },
  { brand: 'Dulux', name: 'Bright Skies', code: '', hex: '#d6e4e8' },
  { brand: 'Dulux', name: 'Denim Drift', code: '', hex: '#8296a4' },
  { brand: 'Dulux', name: 'Sapphire Salute', code: '', hex: '#38495c' },
  // ── Warm earths, clays, and reds ─────────────────────────────────────────
  // The palettes this product generates lean warm, and an accent with no close
  // match is a worse answer than a slightly wider catalogue.
  { brand: 'Farrow & Ball', name: 'Red Earth', code: 'No.64', hex: '#c08a6d' },
  { brand: 'Farrow & Ball', name: 'Book Room Red', code: 'No.50', hex: '#a4685c' },
  { brand: 'Farrow & Ball', name: 'Picture Gallery Red', code: 'No.42', hex: '#8f4a44' },
  { brand: 'Farrow & Ball', name: "Charlotte's Locks", code: 'No.268', hex: '#df6c34' },
  { brand: 'Farrow & Ball', name: 'Sudbury Yellow', code: 'No.51', hex: '#d8ac6a' },
  { brand: 'Benjamin Moore', name: 'Audubon Russet', code: 'HC-51', hex: '#a05e46' },
  { brand: 'Benjamin Moore', name: 'Cinnamon', code: '2174-20', hex: '#a85c3e' },
  { brand: 'Benjamin Moore', name: 'Georgian Brick', code: 'HC-50', hex: '#9b5a45' },
  { brand: 'Sherwin-Williams', name: 'Cavern Clay', code: 'SW 7701', hex: '#ae6a4e' },
  { brand: 'Sherwin-Williams', name: 'Rookwood Terra Cotta', code: 'SW 2803', hex: '#9c5c46' },
  { brand: 'Sherwin-Williams', name: 'Redend Point', code: 'SW 9081', hex: '#b08b7d' },
  { brand: 'Dulux', name: 'Copper Blush', code: '', hex: '#c4785e' },
  { brand: 'Dulux', name: 'Spiced Honey', code: '', hex: '#c99c62' },
];

// LAB is computed once at module load; matching is then pure arithmetic.
const INDEXED = PAINTS.map((paint) => ({ ...paint, lab: hexToLab(paint.hex) }));

export const BRANDS = [...new Set(PAINTS.map((p) => p.brand))];

/**
 * How close is close? These are ΔE2000 thresholds, and they are what stops the
 * feature over-claiming: anything past `close` is reported as a direction to
 * explore rather than a match.
 */
function confidenceFor(deltaE) {
  if (deltaE < 2) return 'exact';
  if (deltaE < 5) return 'close';
  if (deltaE < 10) return 'near';
  return 'approximate';
}

/** The `limit` nearest paints to one hex value. */
export function matchOne(hex, { limit = 3, brand = null } = {}) {
  let pool = INDEXED;
  if (brand) pool = pool.filter((p) => p.brand === brand);
  if (!pool.length) return [];

  const target = hexToLab(hex);
  return pool
    .map((paint) => {
      const deltaE = deltaE2000(target, paint.lab);
      return {
        brand: paint.brand,
        name: paint.name,
        code: paint.code,
        hex: paint.hex,
        deltaE: Math.round(deltaE * 10) / 10,
        confidence: confidenceFor(deltaE),
      };
    })
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}

/**
 * Match a whole board palette. Returns one entry per swatch, each with its
 * nearest paints, plus the disclaimer the UI must show.
 */
export function matchPalette(palette, options = {}) {
  const swatches = (Array.isArray(palette) ? palette : [])
    .filter((c) => /^#[0-9a-fA-F]{3,6}$/.test(String(c?.hex || '')))
    .map((swatch) => ({
      name: swatch.name,
      hex: swatch.hex,
      role: swatch.role,
      matches: matchOne(swatch.hex, options),
    }));

  return { disclaimer: DISCLAIMER, swatches };
}

export { PAINTS };
