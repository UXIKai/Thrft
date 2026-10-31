import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })

const email = 'cloud@thrft.local'
const password = 'cloud-cloud-cloud'

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
await page.locator('input[type="email"], input[autocomplete="email"]').first().fill(email)
await page.locator('input[type="password"]').first().fill(password)
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })
await page.getByRole('button', { name: 'Home', exact: true }).click().catch(() => {})
await page.waitForTimeout(800)

const brandsBtn = page.getByRole('button', { name: 'Open brands', exact: true })
const categoryBtn = page.getByRole('button', { name: 'Open category', exact: true })
await brandsBtn.waitFor({ timeout: 10000 })
await categoryBtn.waitFor({ timeout: 5000 })

const pair = await page.evaluate(() => {
  const nav = document.querySelector('.home-filter-links')
  const btns = [...document.querySelectorAll('.home-filter-link')].map((b) => b.textContent)
  const wheel = document.querySelector('.home-type-wheel')
  return {
    texts: btns,
    sideBySide: !!nav && getComputedStyle(nav).display.includes('flex'),
    hasOldWheel: !!wheel,
  }
})
console.log('home', JSON.stringify(pair))
await shot('thrft_home_filter_links')

await brandsBtn.click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(500)
await shot('thrft_home_brands_open')

const stage = page.locator('.brand-globe-stage')
const box = await stage.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx + 60, cy - 30)
await page.waitForTimeout(200)
const focusText = await page.locator('.brand-globe-focus').textContent()
console.log('brandFocus', focusText)
await page.evaluate(() => document.querySelector('.brand-globe-focus')?.click())
await page.waitForSelector('.home-filter-links', { timeout: 5000 })
await page.waitForTimeout(500)

const afterBrand = await page.evaluate(() => ({
  globe: !!document.querySelector('.brand-globe-stage'),
  brandLabel: document.querySelector('.home-filter-link')?.textContent || null,
  links: [...document.querySelectorAll('.home-filter-link')].map((b) => b.textContent),
}))
console.log('afterBrand', JSON.stringify(afterBrand))
await shot('thrft_home_brand_picked')

await categoryBtn.click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(400)
await shot('thrft_home_category_open')

const stage2 = page.locator('.brand-globe-stage')
const box2 = await stage2.boundingBox()
await page.mouse.move(box2.x + box2.width / 2 + 50, box2.y + box2.height / 2 - 20)
await page.waitForTimeout(200)
const catFocus = await page.locator('.brand-globe-focus').textContent()
console.log('catFocus', catFocus)
await page.evaluate(() => document.querySelector('.brand-globe-focus')?.click())
await page.waitForSelector('.home-filter-links', { timeout: 5000 })
await page.waitForTimeout(500)

const afterCat = await page.evaluate(() => ({
  globe: !!document.querySelector('.brand-globe-stage'),
  links: [...document.querySelectorAll('.home-filter-link')].map((b) => b.textContent),
}))
console.log('afterCat', JSON.stringify(afterCat))
await shot('thrft_home_category_picked')

await browser.close()

if (!pair.sideBySide || pair.hasOldWheel || pair.texts.join('|') !== 'Brands|Category') {
  console.error('FAIL home links', pair)
  process.exit(1)
}
if (afterBrand.globe || afterCat.globe) {
  console.error('FAIL picker did not close', { afterBrand, afterCat })
  process.exit(1)
}
if (!afterBrand.links[0] || afterBrand.links[0] === 'Brands') {
  console.error('FAIL brand not applied to link', afterBrand)
  process.exit(1)
}
if (!afterCat.links[1] || afterCat.links[1] === 'Category') {
  console.error('FAIL category not applied to link', afterCat)
  process.exit(1)
}
console.log('OK')
