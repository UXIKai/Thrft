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
  await page.waitForTimeout(300)
  const file = `${name}.png`
  await page.screenshot({ path: path.join(ART, file), fullPage: false })
  fs.copyFileSync(path.join(ART, file), path.join(MEDIA, file))
  console.log('saved', file)
}

function fieldStats() {
  return page.evaluate(() => {
    const focus = document.querySelector('.brand-globe-focus')
    const labels = [...document.querySelectorAll('.brand-globe-field .brand-globe-label')]
    const plane = document.querySelector('.brand-globe-plane')
    const sphere = document.querySelector('.brand-globe-sphere')
    return {
      focusText: focus?.textContent || null,
      labelCount: labels.length,
      hasPlane: !!plane,
      hasSphere: !!sphere,
      dense: document.querySelector('.brand-globe.is-dense') != null,
    }
  })
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type="email"], input[autocomplete="email"]').first().fill(email)
await page.locator('input[type="password"]').first().fill(password)
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })

await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Open brand globe', exact: true }).click()
await page.waitForTimeout(1000)

const idle = await fieldStats()
console.log('idle', JSON.stringify(idle))
await shot('thrft_brand_plane_idle')

const stage = page.locator('.brand-globe-stage')
const box = await stage.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// Inside circle — should pick a brand
await page.mouse.move(cx + 70, cy - 40)
await page.waitForTimeout(180)
const brush1 = await page.locator('.brand-globe-focus').textContent().catch(() => null)
console.log('brush1', brush1)
await shot('thrft_brand_plane_brush1')

await page.mouse.move(cx - 80, cy + 50, { steps: 10 })
await page.waitForTimeout(180)
const brush2 = await page.locator('.brand-globe-focus').textContent().catch(() => null)
console.log('brush2', brush2)
await shot('thrft_brand_plane_brush2')

// Outside circle — center must clear
await page.mouse.move(cx + 180, cy + 180, { steps: 8 })
await page.waitForTimeout(220)
const outside = await fieldStats()
console.log('outside', JSON.stringify(outside))
await shot('thrft_brand_plane_outside')

await browser.close()

if (!idle.hasPlane || idle.hasSphere) {
  console.error('FAIL plane/sphere', idle)
  process.exit(1)
}
if (idle.labelCount < 35) {
  console.error('FAIL expected 30+ added brands', idle)
  process.exit(1)
}
if (idle.focusText) {
  console.error('FAIL idle should have empty center', idle)
  process.exit(1)
}
if (!brush1 || !brush2 || brush1 === brush2) {
  console.error('FAIL brush did not change focus', { brush1, brush2 })
  process.exit(1)
}
if (outside.focusText) {
  console.error('FAIL outside circle should clear center', outside)
  process.exit(1)
}
console.log('OK')
