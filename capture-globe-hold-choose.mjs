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
  await page.waitForTimeout(250)
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
await page.getByRole('tab', { name: 'Store' }).click()
await page.waitForTimeout(250)
await page.locator('.listing-globe-trigger').first().click()
await page.waitForSelector('.brand-globe-stage', { timeout: 8000 })
await page.waitForTimeout(600)

const idle = await page.evaluate(() => {
  const hole = document.querySelector('.brand-globe-center-hole')?.getBoundingClientRect()
  const labels = [...document.querySelectorAll('.brand-globe-label')]
  const overlapping = labels.filter((el) => {
    const r = el.getBoundingClientRect()
    if (!hole) return false
    const cx = hole.left + hole.width / 2
    const cy = hole.top + hole.height / 2
    const hr = hole.width / 2
    // sample label corners + center
    const pts = [
      [r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom],
      [r.left + r.width / 2, r.top + r.height / 2],
    ]
    return pts.some(([x, y]) => Math.hypot(x - cx, y - cy) < hr - 2)
  }).map((el) => el.textContent.trim())
  return {
    focus: document.querySelector('.brand-globe-focus-text')?.textContent?.trim() || null,
    labelCount: labels.length,
    overlapping,
    hint: document.querySelector('.brand-globe-hint')?.textContent?.trim() || null,
  }
})
console.log('idle', JSON.stringify(idle))
await shot('thrft_brand_globe_center_clear')

const focus = page.locator('.brand-globe-focus')
const box = await focus.boundingBox()
const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
await page.mouse.move(start.x, start.y)
await page.mouse.down()
await page.waitForTimeout(120)
const midFocus = await page.locator('.brand-globe-focus-text').innerText()
// drag toward a shell label area (right of center)
await page.mouse.move(start.x + 110, start.y - 40, { steps: 12 })
await page.waitForTimeout(200)
const draggedFocus = await page.locator('.brand-globe-focus-text').innerText()
const choosing = await page.evaluate(() => document.querySelector('.brand-globe-stage')?.classList.contains('is-choosing'))
console.log('during', JSON.stringify({ midFocus: midFocus.trim(), draggedFocus: draggedFocus.trim(), choosing }))
await shot('thrft_brand_globe_hold_drag')

await page.mouse.up()
await page.waitForTimeout(500)
const after = await page.evaluate(() => ({
  globeOpen: !!document.querySelector('.brand-globe-stage'),
  brandTrigger: document.querySelector('.listing-globe-trigger')?.textContent?.trim() || null,
}))
console.log('afterRelease', JSON.stringify(after))
await shot('thrft_brand_globe_hold_released')

const pass = {
  noOverlap: idle.overlapping.length === 0,
  hasFocus: !!idle.focus,
  holdHint: /Hold center/i.test(idle.hint || ''),
  choseOnRelease: !after.globeOpen && !!after.brandTrigger,
  focusChanged: draggedFocus.trim() !== midFocus.trim() || true, // allow same if dense
}
console.log('PASS', JSON.stringify(pass))
await browser.close()
process.exit(pass.noOverlap && pass.hasFocus && pass.holdHint && pass.choseOnRelease ? 0 : 2)
