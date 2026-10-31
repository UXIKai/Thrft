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

async function metrics(seg) {
  await page.getByRole('tab', { name: seg }).click()
  await page.waitForTimeout(400)
  const data = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.listing-orbit-label')].map((el) =>
      el.textContent.trim(),
    )
    const triggers = [...document.querySelectorAll('.listing-globe-trigger')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: el.textContent.trim(),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
      }
    })
    const plus = document.querySelector('.listing-wheel-add')
    const pr = plus?.getBoundingClientRect()
    const row = document.querySelector('.listing-wheels-row')
    return {
      labels,
      triggers,
      plus: pr && {
        x: Math.round(pr.x),
        y: Math.round(pr.y),
        w: Math.round(pr.width),
        h: Math.round(pr.height),
        bottom: Math.round(pr.bottom),
      },
      rowClass: row?.className,
      wheelsClass: document.querySelector('.listing-wheels')?.className,
      yDelta:
        pr && triggers[0]
          ? Math.round(Math.abs(triggers[0].bottom - pr.bottom))
          : null,
    }
  })
  console.log(seg, JSON.stringify(data))
  await shot(`thrft_create_${seg.toLowerCase()}_brand_type_plus`)
  return data
}

const store = await metrics('Store')
const market = await metrics('Market')
const closet = await metrics('Closet')

await page.getByRole('tab', { name: 'Store' }).click()
await page.waitForTimeout(250)
await page.locator('.listing-globe-trigger').first().click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(700)

const globe = await page.evaluate(() => {
  const hole = document.querySelector('.brand-globe-center-hole')
  const focus = document.querySelector('.brand-globe-focus')
  const stage = document.querySelector('.brand-globe-stage')
  const hr = hole?.getBoundingClientRect()
  const fr = focus?.getBoundingClientRect()
  const sr = stage?.getBoundingClientRect()
  const scx = sr ? sr.left + sr.width / 2 : null
  const scy = sr ? sr.top + sr.height / 2 : null
  return {
    hole: !!hole,
    holeSize: hr && { w: Math.round(hr.width), h: Math.round(hr.height) },
    focusText: focus?.textContent?.trim() || null,
    focusDx: fr && scx != null ? Math.round(fr.left + fr.width / 2 - scx) : null,
    focusDy: fr && scy != null ? Math.round(fr.top + fr.height / 2 - scy) : null,
    labelsVisible: [...document.querySelectorAll('.brand-globe-label')].filter(
      (el) => getComputedStyle(el).opacity !== '0' && el.offsetParent !== null,
    ).length,
  }
})
console.log('globe', JSON.stringify(globe))
await shot('thrft_brand_globe_center_seat')

// drag to confirm focus changes while center stays
await page.locator('.brand-globe-stage').hover()
await page.mouse.wheel(0, 900)
await page.waitForTimeout(500)
const after = await page.evaluate(() => ({
  focusText: document.querySelector('.brand-globe-focus')?.textContent?.trim() || null,
  hole: !!document.querySelector('.brand-globe-center-hole'),
}))
console.log('afterScroll', JSON.stringify(after))
await shot('thrft_brand_globe_center_scrolled')

const pass = {
  storeBrand: store.labels.includes('Brand') && store.labels.includes('Type'),
  marketBrand: market.labels.includes('Brand') && market.labels.includes('Type'),
  closetBrand: closet.labels.includes('Brand') && closet.labels.includes('Type'),
  storeY: store.yDelta != null && store.yDelta <= 4,
  marketY: market.yDelta != null && market.yDelta <= 4,
  closetY: closet.yDelta != null && closet.yDelta <= 4,
  hole: globe.hole,
  focusCentered: Math.abs(globe.focusDx || 99) <= 3 && Math.abs(globe.focusDy || 99) <= 3,
  focusFilled: !!globe.focusText,
}
console.log('PASS', JSON.stringify(pass))
const allOk = Object.values(pass).every(Boolean)
await browser.close()
process.exit(allOk ? 0 : 2)
