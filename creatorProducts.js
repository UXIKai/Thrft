const usdPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function mapCreatorProduct(row) {
  return {
    ...row,
    accountId: row.creator_id,
    creatorId: row.creator_id,
    brandName: row.brand,
    brandId: String(row.brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    clothingType: String(row.category || '').toLowerCase(),
    priceRaw: row.price,
    price: usdPrice.format(Number(row.price)),
    photoUrl: row.mockup_urls?.[0] || row.photo_url || '',
    image_url: row.mockup_urls?.[0] || row.photo_url || '',
    printfulVariantId: row.printful_variant_id,
    sizes: row.size ? [row.size] : undefined,
    artworkUrl: row.artwork_url,
    mockupUrls: row.mockup_urls || [],
    createdAt: row.created_at,
    sellerUsername: row.creator_username,
    sellerName: row.creator_name,
  }
}
