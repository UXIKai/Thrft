// Official brand websites, used to retrieve their published site icons.
export const BRAND_DOMAINS = {
  "Levi's": 'levi.com',
  Nike: 'nike.com',
  Adidas: 'adidas.com',
  Gap: 'gap.com',
  Chanel: 'chanel.com',
  Gucci: 'gucci.com',
  Prada: 'prada.com',
  'Louis Vuitton': 'louisvuitton.com',
  'The North Face': 'thenorthface.com',
  Puma: 'puma.com',
  Guess: 'guess.com',
  Zara: 'zara.com',
  'H&M': 'hm.com',
  Uniqlo: 'uniqlo.com',
  'Ralph Lauren': 'ralphlauren.com',
  'Tommy Hilfiger': 'tommy.com',
  'Calvin Klein': 'calvinklein.com',
  'Hugo Boss': 'hugoboss.com',
  Burberry: 'burberry.com',
  Balenciaga: 'balenciaga.com',
  Dior: 'dior.com',
  'Hermès': 'hermes.com',
  Versace: 'versace.com',
  Fendi: 'fendi.com',
  Givenchy: 'givenchy.com',
  'Saint Laurent': 'ysl.com',
  'Off-White': 'off---white.com',
  Supreme: 'supremenewyork.com',
  Carhartt: 'carhartt.com',
  Patagonia: 'patagonia.com',
  Columbia: 'columbia.com',
  'Under Armour': 'underarmour.com',
  'New Balance': 'newbalance.com',
  Converse: 'converse.com',
  Vans: 'vans.com',
  Reebok: 'reebok.com',
  Lululemon: 'lululemon.com',
  "Arc'teryx": 'arcteryx.com',
  Moncler: 'moncler.com',
  'Stone Island': 'stoneisland.com',
  'A.P.C.': 'apc.fr',
  'Acne Studios': 'acnestudios.com',
  'Alexander McQueen': 'alexandermcqueen.com',
  AllSaints: 'allsaints.com',
  ASICS: 'asics.com',
  Balmain: 'balmain.com',
  Bape: 'bape.com',
  Birkenstock: 'birkenstock.com',
  'Bottega Veneta': 'bottegaveneta.com',
  'Canada Goose': 'canadagoose.com',
  Champion: 'champion.com',
  Coach: 'coach.com',
  'Comme des Garçons': 'comme-des-garcons.com',
  Dickies: 'dickies.com',
  'Dolce & Gabbana': 'dolcegabbana.com',
  'Dr. Martens': 'drmartens.com',
  'Fear of God': 'fearofgod.com',
  Fila: 'fila.com',
  'Fred Perry': 'fredperry.com',
  'Helly Hansen': 'hellyhansen.com',
  'J.Crew': 'jcrew.com',
  Jordan: 'jordan.com',
  Kenzo: 'kenzo.com',
  Lacoste: 'lacoste.com',
  Loewe: 'loewe.com',
  Mango: 'shop.mango.com',
  Marni: 'marni.com',
  MCM: 'mcmworldwide.com',
  'Michael Kors': 'michaelkors.com',
  'Miu Miu': 'miumiu.com',
  Moschino: 'moschino.com',
  Oakley: 'oakley.com',
  'Our Legacy': 'ourlegacy.com',
  Palace: 'palaceskateboards.com',
  'Palm Angels': 'palmangels.com',
  'Paul Smith': 'paulsmith.com',
  'Ray-Ban': 'ray-ban.com',
  Rhude: 'rh-ude.com',
  'Rick Owens': 'rickowens.eu',
  Salomon: 'salomon.com',
  Sandro: 'sandro-paris.com',
  Stussy: 'stussy.com',
  Theory: 'theory.com',
  'Tiffany & Co.': 'tiffany.com',
  Timberland: 'timberland.com',
  UGG: 'ugg.com',
  Valentino: 'valentino.com',
  Vetements: 'vetementswebsite.com',
  Vince: 'vince.com',
  Yeezy: 'yeezy.com',
  Cartier: 'cartier.com',
  Bulgari: 'bulgari.com',
  'Van Cleef & Arpels': 'vancleefarpels.com',
  'Harry Winston': 'harrywinston.com',
  Graff: 'graff.com',
  Chopard: 'chopard.com',
  Boucheron: 'boucheron.com',
  Piaget: 'piaget.com',
  Mikimoto: 'mikimoto.com',
  'David Yurman': 'davidyurman.com',
  Pandora: 'pandora.net',
  Swarovski: 'swarovski.com',
  Buccellati: 'buccellati.com',
  Messika: 'messika.com',
  Mejuri: 'mejuri.com',
  'Blue Nile': 'bluenile.com',
}

export function brandLogoUrl(name) {
  const domain = BRAND_DOMAINS[name]
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null
}

export const BRAND_LOGO_TILE_PX = 42
const LOGO_CLEARANCE_PX = Math.SQRT2 * BRAND_LOGO_TILE_PX + 20

export function packBrandLogoLanes(brands, seatPx = 59) {
  const slots = []
  let radius = seatPx + Math.SQRT2 * BRAND_LOGO_TILE_PX / 2 + 24
  let ring = 0
  let maxR = 0
  while (slots.length < brands.length) {
    const capacity = Math.max(1, Math.floor(
      Math.PI / Math.asin(Math.min(1, LOGO_CLEARANCE_PX / (2 * radius))),
    ))
    const count = Math.min(capacity, brands.length - slots.length)
    const step = Math.PI * 2 / count
    for (let i = 0; i < count; i += 1) {
      slots.push({ lon: (i + (ring % 2) * 0.5) * step, r: radius, ring })
    }
    maxR = radius
    radius += LOGO_CLEARANCE_PX
    ring += 1
  }
  return { slots, maxR }
}
