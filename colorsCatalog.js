// 11 base colors × 5 shades each.
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

export const COLOR_OPTIONS = Object.values(COLOR_FAMILIES)
  .flat()
  .map((label) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label }))
