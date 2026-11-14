/** Brand metadata only. Listings come from Supabase, never this catalog. */

export const BRAND_ROWS = [
  {
    id: 'lv',
    name: 'Louis Vuitton',
    category: 'Luxury Fashion',
    prefix: 'LO',
  },
  {
    id: 'nike',
    name: 'Nike',
    category: 'Sportswear & Performance',
    prefix: 'NI',
  },
  {
    id: 'adidas',
    name: 'Adidas',
    category: 'Sportswear',
    prefix: 'AD',
  },
  {
    id: 'chanel',
    name: 'Chanel',
    category: 'Luxury Fashion',
    prefix: 'CH',
  },
  {
    id: 'gucci',
    name: 'Gucci',
    category: 'Luxury Fashion',
    prefix: 'GU',
  },
  {
    id: 'prada',
    name: 'Prada',
    category: 'Luxury Fashion',
    prefix: 'PR',
  },
  {
    id: 'gap',
    name: 'Gap',
    category: 'Casual Apparel',
    prefix: 'GA',
  },
  {
    id: 'northface',
    name: 'The North Face',
    category: 'Outdoor',
    prefix: 'TN',
  },
  {
    id: 'puma',
    name: 'Puma',
    category: 'Sportswear',
    prefix: 'PU',
  },
  {
    id: 'guess',
    name: 'Guess',
    category: 'Contemporary Fashion',
    prefix: 'GS',
  },
]

const EXTRA_STORE_BRANDS = [
  ['levis', "Levi's", 'Denim & Casual', 55],
  ['carhartt', 'Carhartt', 'Workwear', 60],
  ['supreme', 'Supreme', 'Streetwear', 90],
  ['ralphlauren', 'Ralph Lauren', 'Classic American', 70],
  ['tommyhilfiger', 'Tommy Hilfiger', 'Classic American', 58],
  ['calvinklein', 'Calvin Klein', 'Contemporary Fashion', 52],
  ['underarmour', 'Under Armour', 'Sportswear', 38],
  ['newbalance', 'New Balance', 'Sportswear & Footwear', 64],
  ['vans', 'Vans', 'Skate & Footwear', 45],
  ['converse', 'Converse', 'Footwear', 44],
  ['champion', 'Champion', 'Athletic Basics', 34],
  ['hollister', 'Hollister', 'Casual', 32],
  ['abercrombie', 'Abercrombie & Fitch', 'Casual', 46],
  ['americaneagle', 'American Eagle', 'Casual', 33],
  ['hm', 'H&M', 'Fast Fashion', 22],
  ['zara', 'Zara', 'Fast Fashion', 35],
  ['uniqlo', 'Uniqlo', 'Essentials', 30],
  ['lululemon', 'Lululemon', 'Activewear', 68],
  ['patagonia', 'Patagonia', 'Outdoor', 85],
  ['dickies', 'Dickies', 'Workwear', 36],
  ['fila', 'Fila', 'Sportswear', 40],
  ['reebok', 'Reebok', 'Sportswear', 41],
  ['hermes', 'Hermès', 'Luxury Fashion', 220],
  ['dior', 'Dior', 'Luxury Fashion', 190],
  ['burberry', 'Burberry', 'Luxury Fashion', 150],
  ['versace', 'Versace', 'Luxury Fashion', 140],
  ['balenciaga', 'Balenciaga', 'Luxury Streetwear', 170],
  ['fendi', 'Fendi', 'Luxury Fashion', 160],
  ['coach', 'Coach', 'Accessible Luxury', 75],
  ['michaelkors', 'Michael Kors', 'Accessible Luxury', 68],
].map(([id, name, category]) => ({
  id,
  name,
  category,
  prefix: id.toUpperCase(),
}))

/** Known brand names and IDs for filters and navigation. */
export const STORE_BRAND_ROWS = [...BRAND_ROWS, ...EXTRA_STORE_BRANDS]

export function findBrandById(brandId) {
  return STORE_BRAND_ROWS.find((b) => b.id === brandId) || null
}
