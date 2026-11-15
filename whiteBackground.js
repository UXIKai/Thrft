/** Remove only a uniform, near-white backdrop connected to the image edges. */
export function removeWhiteBackdrop({ data, width, height }) {
  const border = []
  for (let x = 0; x < width; x++) {
    border.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y++) {
    border.push(y * width, y * width + width - 1)
  }
  const light = border.filter((pixel) => {
    const i = pixel * 4
    const min = Math.min(data[i], data[i + 1], data[i + 2])
    return data[i + 3] > 250 && min >= 230 &&
      Math.max(data[i], data[i + 1], data[i + 2]) - min <= 12
  })
  if (!border.length || light.length / border.length < 0.95) return false
  const background = [0, 1, 2].map((channel) => {
    const values = light.map((pixel) => data[pixel * 4 + channel]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  })
  const distance = (pixel) => {
    const i = pixel * 4
    return Math.max(Math.abs(data[i] - background[0]), Math.abs(data[i + 1] - background[1]),
      Math.abs(data[i + 2] - background[2]))
  }
  if (light.filter((pixel) => distance(pixel) <= 6).length / border.length < 0.95) return false

  const visited = new Uint8Array(width * height)
  const queue = new Uint32Array(width * height)
  let head = 0
  let tail = 0
  function add(pixel) {
    if (visited[pixel]) return
    visited[pixel] = 1
    if (data[pixel * 4 + 3] === 0 || distance(pixel) <= 12) queue[tail++] = pixel
  }
  border.forEach(add)
  while (head < tail) {
    const pixel = queue[head++]
    const x = pixel % width
    if (x > 0) add(pixel - 1)
    if (x < width - 1) add(pixel + 1)
    if (pixel >= width) add(pixel - width)
    if (pixel < width * (height - 1)) add(pixel + width)
  }
  if (tail < width * height * 0.03 || tail > width * height * 0.98) return false
  for (let i = 0; i < tail; i++) {
    const pixel = queue[i]
    const feather = Math.min(1, Math.max(0, (distance(pixel) - 6) / 6))
    data[pixel * 4 + 3] = Math.round(data[pixel * 4 + 3] * feather)
  }
  return true
}

export async function cutoutWhiteBackground(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read product photo'))
      img.src = url
    })
    const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (!removeWhiteBackdrop(pixels)) return null
    ctx.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
