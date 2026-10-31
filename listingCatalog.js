/** Options for the New Listing form + home type strip. */

/** Create destinations: peer marketplace + personal closet. */
export const LISTING_SEGMENTS = [
  { id: 'market', label: 'Market', icon: 'market' },
  { id: 'closet', label: 'Closet', icon: 'closet' },
]

export const LISTING_BRANDS = [
  "Levi's",
  'Nike',
  'Adidas',
  'Gap',
  'Chanel',
  'Gucci',
  'Prada',
  'Louis Vuitton',
  'The North Face',
  'Puma',
  'Guess',
  'Zara',
  'H&M',
  'Uniqlo',
  'Ralph Lauren',
  'Tommy Hilfiger',
  'Calvin Klein',
  'Hugo Boss',
  'Burberry',
  'Balenciaga',
  'Dior',
  'Hermès',
  'Versace',
  'Fendi',
  'Givenchy',
  'Saint Laurent',
  'Off-White',
  'Supreme',
  'Carhartt',
  'Patagonia',
  'Columbia',
  'Under Armour',
  'New Balance',
  'Converse',
  'Vans',
  'Reebok',
  'Lululemon',
  "Arc'teryx",
  'Moncler',
  'Stone Island',
  'A.P.C.',
  'Acne Studios',
  'Alexander McQueen',
  'AllSaints',
  'ASICS',
  'Balmain',
  'Bape',
  'Birkenstock',
  'Bottega Veneta',
  'Canada Goose',
  'Champion',
  'Coach',
  'Comme des Garçons',
  'Dickies',
  'Dolce & Gabbana',
  'Dr. Martens',
  'Fear of God',
  'Fila',
  'Fred Perry',
  'Helly Hansen',
  'J.Crew',
  'Jordan',
  'Kenzo',
  'Lacoste',
  'Loewe',
  'Mango',
  'Marni',
  'MCM',
  'Michael Kors',
  'Miu Miu',
  'Moschino',
  'Oakley',
  'Our Legacy',
  'Palace',
  'Palm Angels',
  'Paul Smith',
  'Ray-Ban',
  'Rhude',
  'Rick Owens',
  'Salomon',
  'Sandro',
  'Stussy',
  'Theory',
  'Tiffany & Co.',
  'Timberland',
  'UGG',
  'Valentino',
  'Vetements',
  'Vince',
  'Yeezy',
  'Other',
]

/** Unique brand names for Create wheel + globe (plus optional customs). */
export function createBrandNames(extra = []) {
  const seen = new Set()
  const list = []
  for (const name of [...LISTING_BRANDS, ...extra]) {
    const label = String(name || '').trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    list.push(label)
  }
  return list
}

/**
 * One short label per clothing item — readable on chips and timer wheels.
 * Keep each name a single short word (or tight compound like Tees).
 */
export const LISTING_CATEGORIES = [
  'Tees',
  'Shirts',
  'Polos',
  'Tanks',
  'Hoodies',
  'Sweaters',
  'Jackets',
  'Coats',
  'Blazers',
  'Pants',
  'Jeans',
  'Shorts',
  'Skirts',
  'Dresses',
  'Rompers',
  'Shoes',
  'Sneakers',
  'Boots',
  'Bags',
  'Hats',
  'Belts',
  'Jewelry',
  'Active',
  'Swim',
  'Lounge',
]

export const LISTING_CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
