import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

async function shot(name) {
  await page.waitForTimeout(200)
  const dest = path.join(ART, `${name}.png`)
  await page.screenshot({ path: dest })
  fs.copyFileSync(dest, path.join(MEDIA, `${name}.png`))
  console.log('saved', name)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type="email"], input[autocomplete="email"]').first().fill('cloud@thrft.local')
await page.locator('input[type="password"]').first().fill('cloud-cloud-cloud')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })
await page.getByRole('button', { name: 'Create', exact: true }).click()
await page.waitForTimeout(400)
await page.locator('.listing-globe-trigger').first().click()
await page.waitForSelector('.brand-globe-focus-text')
await page.waitForTimeout(400)

async function measure() {
  return page.evaluate(() => {
    const btn = document.querySelector('.brand-globe-focus')
    const text = document.querySelector('.brand-globe-focus-text')
    const hole = document.querySelector('.brand-globe-center-hole')
    if (!btn || !text || !hole) return null
    const br = btn.getBoundingClientRect()
    const tr = text.getBoundingClientRect()
    const hr = hole.getBoundingClientRect()
    const cx = hr.left + hr.width / 2
    const cy = hr.top + hr.height / 2
    const radius = hr.width / 2
    const corners = [
      [tr.left, tr.top], [tr.right, tr.top], [tr.left, tr.bottom], [tr.right, tr.bottom],
    ]
    const outside = corners.filter(([x, y]) => Math.hypot(x - cx, y - cy) > radius - 1)
    return {
      label: text.textContent.trim(),
      fontSize: getComputedStyle(text).fontSize,
      textW: Math.round(tr.width),
      textH: Math.round(tr.height),
      btnW: Math.round(br.width),
      scrollW: text.scrollWidth,
      clientW: text.clientWidth,
      scrollH: text.scrollHeight,
      clientH: text.clientHeight,
      fitsBox: text.scrollWidth <= text.clientWidth + 1 && text.scrollHeight <= btn.clientHeight - 8,
      outsideCorners: outside.length,
      insideCircle: outside.length === 0,
    }
  })
}

const samples = []
// sample idle + a few spun seats
for (let i = 0; i < 6; i++) {
  const box = await page.locator('.brand-globe-focus').boundingBox()
  const s = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(s.x, s.y)
  await page.mouse.down()
  await page.mouse.move(s.x + 40 + i * 25, s.y - 10 + i * 8, { steps: 10 })
  await page.waitForTimeout(80)
  // don't release — keep choosing so we can sample long names; actually release would close.
  // Better: rotate without choosing via stage drag outside center
  await page.mouse.up()
  await page.waitForTimeout(500)
  // reopen if closed
  if (!(await page.locator('.brand-globe-stage').count())) {
    await page.locator('.listing-globe-trigger').first().click()
    await page.waitForSelector('.brand-globe-focus-text')
    await page.waitForTimeout(300)
  }
}

// Prefer: open globe, drag stage (not center) to spin, measure several focuses
if (!(await page.locator('.brand-globe-stage').count())) {
  await page.locator('.listing-globe-trigger').first().click()
  await page.waitForSelector('.brand-globe-focus-text')
}
await page.waitForTimeout(300)

for (let i = 0; i < 8; i++) {
  const stage = await page.locator('.brand-globe-stage').boundingBox()
  // drag outside center to spin without selecting
  await page.mouse.move(stage.x + stage.width * 0.78, stage.y + stage.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(stage.x + stage.width * 0.78 - 70, stage.y + stage.height * 0.4, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(220)
  const m = await measure()
  if (m) samples.push(m)
}

console.log(JSON.stringify(samples, null, 2))
const longOnes = samples.filter((s) => s.label.length >= 10)
const allFit = samples.every((s) => s.insideCircle && s.fitsBox)
console.log('long', JSON.stringify(longOnes))
console.log('allFit', allFit)

await shot('thrft_brand_globe_focus_fit')
// specifically try to land on Saint Laurent by hold-spin then screenshot mid-hold without release
const box = await page.locator('.brand-globe-focus').boundingBox()
const s = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
await page.mouse.move(s.x, s.y)
await page.mouse.down()
for (let i = 0; i < 20; i++) {
  await page.mouse.move(s.x + 20 + i * 8, s.y + (i % 2) * 10, { steps: 3 })
  await page.waitForTimeout(40)
  const label = (await page.locator('.brand-globe-focus-text').innerText()).trim()
  if (label.length >= 11) {
    const m = await measure()
    console.log('longHold', JSON.stringify(m))
    await shot(`thrft_brand_globe_focus_fit_${label.replace(/\W+/g, '_').toLowerCase()}`)
    break
  }
}
await page.mouse.up()

await browser.close()
process.exit(allFit ? 0 : 2)
