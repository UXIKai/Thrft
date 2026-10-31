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

await page.getByRole('button', { name: 'Open brands' }).click()
await page.waitForSelector('.brand-globe-stage')
await page.waitForTimeout(450)

const stage = page.locator('.brand-globe-stage')
const box = await stage.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// Brush onto a shell brand
await page.mouse.move(cx + 90, cy - 20)
await page.waitForTimeout(200)
const locked = await page.locator('.brand-globe-focus').textContent()
console.log('locked', locked)
await shot('thrft_brands_layout_neat')

// Move across center — focus must stay locked (center dead zone)
await page.mouse.move(cx, cy, { steps: 12 })
await page.waitForTimeout(150)
const atCenter = await page.locator('.brand-globe-focus').textContent()
console.log('atCenter', atCenter)

// Aim slightly off center then click title
await page.mouse.move(cx + 4, cy - 2)
await page.waitForTimeout(80)
const beforeClick = await page.locator('.brand-globe-focus').textContent()
await page.evaluate(() => document.querySelector('.brand-globe-focus')?.click())
await page.waitForTimeout(600)

const after = await page.evaluate(() => ({
  globe: !!document.querySelector('.brand-globe'),
  links: [...document.querySelectorAll('.home-filter-link')].map((b) => b.textContent),
}))
console.log('after', JSON.stringify(after))
await shot('thrft_brands_center_picked')

// Category for comparison
await page.getByRole('button', { name: 'Open category' }).click()
await page.waitForSelector('.brand-globe-stage')
await page.waitForTimeout(400)
await shot('thrft_category_layout_neat')
await page.locator('.brand-globe-scrim').click({ force: true }).catch(() => {})
await page.waitForTimeout(400)

await browser.close()

if (!locked || atCenter !== locked || beforeClick !== locked) {
  console.error('FAIL center lock', { locked, atCenter, beforeClick })
  process.exit(1)
}
if (after.globe || after.links[0] !== locked) {
  console.error('FAIL pick did not apply', { locked, after })
  process.exit(1)
}
console.log('OK')
