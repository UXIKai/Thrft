import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
const LOCAL = '/tmp/thrft-home-dna/artifacts'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })
fs.mkdirSync(LOCAL, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(name) {
  await page.waitForTimeout(350)
  const file = `${name}.png`
  const dest = path.join(ART, file)
  await page.screenshot({ path: dest, fullPage: false })
  fs.copyFileSync(dest, path.join(MEDIA, file))
  fs.copyFileSync(dest, path.join(LOCAL, file))
  console.log('saved', file)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type="email"], input[autocomplete="email"]').first().fill('cloud@thrft.local')
await page.locator('input[type="password"]').first().fill('cloud-cloud-cloud')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })

await page.getByRole('button', { name: 'Create', exact: true }).click()
await page.waitForTimeout(600)

const storeTab = page.getByRole('tab', { name: 'Store' })
if (await storeTab.count()) await storeTab.click()
await page.waitForTimeout(450)

const storeMetrics = await page.evaluate(() => {
  const wheels = document.querySelector('.listing-wheels')
  const typeCol = document.querySelector('.listing-wheel-col')
  const plus = document.querySelector('.listing-wheel-add')
  const title = document.querySelector('.listing-field .listing-box')
  const price = [...document.querySelectorAll('.listing-field .listing-box')].find(
    (el) => el.querySelector('[aria-label="Price"]'),
  )
  const wr = wheels?.getBoundingClientRect()
  const tr = typeCol?.getBoundingClientRect()
  const pr = plus?.getBoundingClientRect()
  const titleR = title?.getBoundingClientRect()
  const priceR = price?.getBoundingClientRect()
  const cs = getComputedStyle(wheels)
  return {
    wheelsW: wr?.width,
    typeW: tr?.width,
    titleW: titleR?.width,
    priceW: priceR?.width,
    plusRight: pr ? Math.round(pr.right) : null,
    pageW: window.innerWidth,
    maxWidth: cs.maxWidth,
    paddingRight: cs.paddingRight,
    className: wheels?.className,
  }
})
console.log('store', JSON.stringify(storeMetrics))
await shot('thrft_create_store_type_wide')

await page.getByRole('button', { name: 'Add brand or type' }).click()
await page.waitForTimeout(400)
const sheetStyles = await page.evaluate(() => {
  const sheet = document.querySelector('.listing-add-sheet')
  const cs = getComputedStyle(sheet)
  return {
    bg: cs.backgroundColor,
    borderRadius: cs.borderRadius,
    backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    insetRight: cs.right,
  }
})
console.log('sheet', JSON.stringify(sheetStyles))
await shot('thrft_create_store_add_glass')

await page.getByRole('button', { name: 'Close add brand or type' }).click()
await page.waitForTimeout(300)

const marketTab = page.getByRole('tab', { name: 'Market' })
if (await marketTab.count()) await marketTab.click()
await page.waitForTimeout(450)
const marketMetrics = await page.evaluate(() => {
  const wheels = document.querySelector('.listing-wheels')
  const plus = document.querySelector('.listing-wheel-add')
  const cols = [...document.querySelectorAll('.listing-wheel-col')]
  const wr = wheels?.getBoundingClientRect()
  const pr = plus?.getBoundingClientRect()
  return {
    wheelsW: wr?.width,
    colCount: cols.length,
    colWidths: cols.map((c) => Math.round(c.getBoundingClientRect().width)),
    plusRight: pr ? Math.round(pr.right) : null,
    pageW: window.innerWidth,
  }
})
console.log('market', JSON.stringify(marketMetrics))
await shot('thrft_create_market_wheels_wide')

await page.getByRole('button', { name: 'Add brand or type' }).click()
await page.waitForTimeout(400)
await shot('thrft_create_market_add_glass')

await browser.close()

const storeOk =
  storeMetrics.wheelsW > 300 &&
  Math.abs(storeMetrics.wheelsW - storeMetrics.titleW) < 40 &&
  storeMetrics.maxWidth === 'none' &&
  storeMetrics.plusRight > 350
const sheetOk =
  sheetStyles.bg !== 'rgba(12, 12, 12, 0.92)' &&
  !sheetStyles.bg.startsWith('rgb(12, 12, 12)')
console.log('checks', { storeOk, sheetOk, storeMetrics, sheetStyles })
if (!storeOk || !sheetOk) process.exit(2)
console.log('OK')
