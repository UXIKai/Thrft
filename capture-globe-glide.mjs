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
  await page.waitForTimeout(280)
  const file = `${name}.png`
  await page.screenshot({ path: path.join(ART, file), fullPage: false })
  fs.copyFileSync(path.join(ART, file), path.join(MEDIA, file))
  console.log('saved', file)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type="email"]').first().fill('cloud@thrft.local')
await page.locator('input[type="password"]').first().fill('cloud-cloud-cloud')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })
await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Open brand globe', exact: true }).click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(600)

async function labels() {
  return page.evaluate(() => {
    const front = document.querySelector('.brand-globe-label.is-front')?.textContent || ''
    const ring = [...document.querySelectorAll('.brand-globe-label:not(.is-front)')].map((el) => {
      const t = el.style.transform || ''
      const m = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
      return { name: el.textContent, x: m ? +m[1] : null, y: m ? +m[2] : null }
    })
    return { front, ring }
  })
}

const before = await labels()
console.log('before', before.front, 'ringSample', before.ring.slice(0, 3))
await shot('thrft_globe_glide_before')

const box = await page.locator('.brand-globe-stage').boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
const r = Math.min(box.width, box.height) * 0.34

await page.mouse.move(cx + r, cy)
await page.mouse.down()
const steps = 36
const sweep = (Math.PI * 2) * (120 / 360)
const mids = []
for (let i = 1; i <= steps; i++) {
  const a = (sweep * i) / steps
  await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  if (i === 12 || i === 24) {
    mids.push(await labels())
  }
  await page.waitForTimeout(12)
}
await shot('thrft_globe_glide_mid')
await page.mouse.up()
await page.waitForTimeout(220)
const after = await labels()
console.log('mid1', mids[0]?.front, 'ring0', mids[0]?.ring?.[0])
console.log('mid2', mids[1]?.front, 'ring0', mids[1]?.ring?.[0])
console.log('after', after.front)

// Ring should have moved during glide (positions change), not only at end
const movedDuring = mids.some((m, idx) => {
  if (!m || !before.ring[0] || !m.ring[0]) return false
  const b = before.ring.find((x) => x.name === m.ring[0].name) || before.ring[0]
  const cur = m.ring.find((x) => x.name === b.name) || m.ring[0]
  return Math.hypot((cur.x ?? 0) - (b.x ?? 0), (cur.y ?? 0) - (b.y ?? 0)) > 8
})
console.log('ringMovedDuringGlide', movedDuring)
console.log('centerChanged', before.front !== after.front)

await shot('thrft_globe_glide_after')
await browser.close()
if (!movedDuring) {
  console.error('FAIL: ring did not orbit during glide')
  process.exit(2)
}
console.log('ok')
