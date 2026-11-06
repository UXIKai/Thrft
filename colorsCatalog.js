// 11 base colors × 5 shades each, plus jewelry metals.
export const COLOR_FAMILIES = {
  Red: ['Crimson', 'Scarlet', 'Burgundy', 'Maroon', 'Coral'],
  Orange: ['Tangerine', 'Burnt Orange', 'Rust', 'Peach', 'Apricot'],
  Yellow: ['Lemon', 'Mustard', 'Gold', 'Cream', 'Canary'],
  Green: ['Olive', 'Forest', 'Emerald', 'Mint', 'Sage'],
  Blue: ['Navy', 'Royal Blue', 'Sky Blue', 'Teal', 'Baby Blue'],
  Purple: ['Lavender', 'Violet', 'Plum', 'Lilac', 'Eggplant'],
  Pink: ['Blush', 'Hot Pink', 'Rose', 'Fuchsia', 'Salmon'],
  Brown: ['Tan', 'Chocolate', 'Camel', 'Khaki', 'Beige'],
  Gray: ['Charcoal', 'Slate', 'Heather Gray', 'Silver', 'Ash'],
  Black: ['Jet Black', 'Onyx', 'Faded Black', 'Off Black', 'Washed Black'],
  White: ['Ivory', 'Off White', 'Snow', 'Pearl', 'Bone'],
}

export const JEWELRY_METALS = [
  'Yellow Gold',
  'White Gold',
  'Rose Gold',
  'Platinum',
  'Sterling Silver',
  'Bronze',
  'Copper',
  'Brass',
  'Titanium',
  'Gunmetal',
  'Pewter',
  'Stainless Steel',
  'Two-Tone',
]

export const EXTRA_COLORS = ['Turquoise', 'Magenta']

export const COLOR_OPTIONS = [...Object.values(COLOR_FAMILIES).flat(), ...JEWELRY_METALS, ...EXTRA_COLORS]
  .map((label) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label }))

const HEX = {
  crimson: '#dc143c', scarlet: '#ff2400', burgundy: '#800020', maroon: '#800000', coral: '#ff7f50',
  tangerine: '#f28500', 'burnt-orange': '#cc5500', rust: '#b7410e', peach: '#ffcba4', apricot: '#fbceb1',
  lemon: '#fff44f', mustard: '#e1ad01', gold: '#d4af37', cream: '#fffdd0', canary: '#ffef00',
  olive: '#808000', forest: '#228b22', emerald: '#50c878', mint: '#98ff98', sage: '#9caf88',
  navy: '#001f5b', 'royal-blue': '#4169e1', 'sky-blue': '#87ceeb', teal: '#008080', 'baby-blue': '#89cff0',
  lavender: '#b497d6', violet: '#8f00ff', plum: '#8e4585', lilac: '#c8a2c8', eggplant: '#614051',
  blush: '#de5d83', 'hot-pink': '#ff69b4', rose: '#ff007f', fuchsia: '#c154c1', salmon: '#fa8072',
  tan: '#d2b48c', chocolate: '#5c3317', camel: '#c19a6b', khaki: '#bdb76b', beige: '#d9c7a3',
  charcoal: '#36454f', slate: '#708090', 'heather-gray': '#9aa0a6', silver: '#c0c0c0', ash: '#b2beb5',
  'jet-black': '#0a0a0a', onyx: '#353839', 'faded-black': '#3b3b3b', 'off-black': '#1c1c1c', 'washed-black': '#4a4a4a',
  ivory: '#fffff0', 'off-white': '#f5f5ee', snow: '#fffafa', pearl: '#eae0c8', bone: '#e3dac9',
  'yellow-gold': '#d4af37', 'white-gold': '#e8e4d8', 'rose-gold': '#b76e79', platinum: '#e5e4e2',
  'sterling-silver': '#c0c0c0', bronze: '#cd7f32', copper: '#b87333', brass: '#b5a642', titanium: '#878681',
  turquoise: '#30d5c8', magenta: '#ff00ff',
  gunmetal: '#2a3439', pewter: '#8b8d8f', 'stainless-steel': '#b0b3b8', 'two-tone': '#c9a96e',
}

export function colorHex(id) {
  return HEX[id] || null
}
