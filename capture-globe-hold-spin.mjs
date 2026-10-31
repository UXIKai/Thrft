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
await page.waitForSelector('.brand-globe-stage')
await page.waitForTimeout(500)

const sample = () => page.evaluate(() => {
  const labels = [...document.querySelectorAll('.brand-globe-label')].slice(0, 8).map((el) => {
    const t = el.style.transform || ''
    const m = t.match(/translate\((-?\d+\.?\d*)px,\s*(-?\d+\.?\d*)px\)/)
    return { id: el.getAttribute('data-brand-id'), x: m ? +m[1] : null, y: m ? +m[2] : null }
  })
  return {
    focus: document.querySelector('.brand-globe-focus-text')?.textContent?.trim(),
    choosing: document.querySelector('.brand-globe-stage')?.classList.contains('is-choosing'),
    rotating: document.querySelector('.brand-globe-stage')?.classList.contains('is-rotating'),
    labels,
    hint: document.querySelector('.brand-globe-hint')?.textContent?.trim(),
  }
})

const before = await sample()
console.log('before', JSON.stringify({ focus: before.focus, labels: before.labels.slice(0, 3) }))
await shot('thrft_brand_globe_spin_before')

const box = await page.locator('.brand-globe-focus').boundingBox()
const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
await page.mouse.move(start.x, start.y)
await page.mouse.down()
await page.mouse.move(start.x + 140, start.y + 30, { steps: 16 })
await page.waitForTimeout(150)
const mid = await sample()
console.log('mid', JSON.stringify({ focus: mid.focus, choosing: mid.choosing, rotating: mid.rotating, labels: mid.labels.slice(0, 3) }))
await shot('thrft_brand_globe_spin_drag')

await page.mouse.up()
await page.waitForTimeout(400)
const after = await page.evaluate(() => ({
  open: !!document.querySelector('.brand-globe-stage'),
  brand: document.querySelector('.listing-globe-trigger')?.textContent?.trim(),
}))
console.log('after', JSON.stringify(after))

const moved = before.labels.some((b, i) => {
  const a = mid.labels[i]
  return a && b.id === a.id && (b.x !== a.x || b.y !== a.y)
}) || before.labels[0]?.id !== mid.labels[0]?.id
const pass = {
  spun: moved || before.focus !== mid.focus,
  chose: !after.open && !!after.brand,
  hintSpin: /spin/i.test(before.hint || ''),
}
console.log('PASS', JSON.stringify(pass))
await browser.close()
process.exit(pass.spun && pass.chose ? 0 : 2)
