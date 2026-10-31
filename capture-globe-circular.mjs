import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(name) {
  await page.waitForTimeout(350)
  const file = `${name}.png`
  await page.screenshot({ path: path.join(ART, file), fullPage: false })
  fs.copyFileSync(path.join(ART, file), path.join(MEDIA, file))
  console.log('saved', file)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type="email"], input[autocomplete="email"]').first().fill('cloud@thrft.local')
await page.locator('input[type="password"]').first().fill('cloud-cloud-cloud')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })

await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(700)

await page.getByRole('button', { name: 'Open brand globe', exact: true }).click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(700)

async function centerBrand() {
  return page.locator('.brand-globe-label.is-front').first().innerText()
}

const before = await centerBrand()
console.log('before', before)
await shot('thrft_globe_circular_before')

const box = await page.locator('.brand-globe-stage').boundingBox()
if (!box) throw new Error('no stage')
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
const r = Math.min(box.width, box.height) * 0.34

// Glide clockwise ~210° around the ring — should cycle center brand
await page.mouse.move(cx + r, cy)
await page.mouse.down()
const steps = 28
const start = 0
const sweep = (Math.PI * 2) * (210 / 360)
for (let i = 1; i <= steps; i++) {
  const a = start + (sweep * i) / steps
  await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  await page.waitForTimeout(16)
}
await page.waitForTimeout(200)
await shot('thrft_globe_circular_mid')
await page.mouse.up()
await page.waitForTimeout(250)

const after = await centerBrand()
console.log('after', after)
await shot('thrft_globe_circular_after')

// Verify angular path changed selection (or at least yaw snapped)
const changed = before !== after
console.log('centerChanged', changed)

// Second arc to prove continuous orbital browse
await page.mouse.move(cx + r, cy)
await page.mouse.down()
for (let i = 1; i <= steps; i++) {
  const a = start + (sweep * i) / steps
  await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  await page.waitForTimeout(12)
}
await page.mouse.up()
await page.waitForTimeout(250)
const after2 = await centerBrand()
console.log('after2', after2)
await shot('thrft_globe_circular_after2')

await browser.close()
if (!changed && before === after2) {
  console.error('FAIL: circular glide did not change center brand')
  process.exit(2)
}
console.log('ok')
