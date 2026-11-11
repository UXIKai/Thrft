export function isCreateStepFilled(step, {
  isCloset,
  scanPreview,
  marketPhotos,
  title,
  brand,
  category,
  price,
  condition,
  description,
  materials,
  dateM,
  dateD,
  dateY,
}) {
  switch (step) {
    case 'photo':
      return isCloset ? Boolean(scanPreview) : marketPhotos.length > 0
    case 'title':
      return Boolean(title.trim())
    case 'details':
      return Boolean(brand.trim() && category.trim())
    case 'price':
      return Boolean(price.trim())
    case 'condition':
      return Boolean(condition.trim())
    case 'description':
      return Boolean(description.trim())
    case 'materials':
      return Boolean(materials.trim())
    case 'date':
      return Boolean(dateM && dateD && dateY)
    default:
      return false
  }
}
