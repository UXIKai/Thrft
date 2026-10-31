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
  await page.waitForTimeout(300)
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
await page.waitForTimeout(500)
await page.getByRole('tab', { name: 'Market' }).click()
await page.waitForTimeout(350)

const before = await page.evaluate(() => {
  const cols = [...document.querySelectorAll('.listing-wheels .listing-wheel-col')]
  const plus = document.querySelector('.listing-wheel-add')
  const box = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, border: cs.borderTopWidth, radius: cs.borderRadius,
    }
  }
  const triggers = cols.map((col) => {
    const label = col.querySelector('.listing-orbit-label')?.textContent.trim()
    const btn = col.querySelector('.listing-globe-trigger')
    return { label, btn: box(btn) }
  })
  return { triggers, plus: box(plus) }
})
console.log('before', JSON.stringify(before))
await shot('thrft_create_add_before')

await page.getByRole('button', { name: 'Add brand or type' }).click()
await page.waitForTimeout(400)

const after = await page.evaluate(() => {
  const cols = [...document.querySelectorAll('.listing-add-toggles .listing-wheel-col')]
  const plus = document.querySelector('.listing-wheel-add')
  const sheet = document.querySelector('.listing-add-sheet')
  const scrim = document.querySelector('.listing-add-scrim')
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, border: cs.borderTopWidth, radius: cs.borderRadius,
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    }
  }
  const toggles = cols.map((col) => {
    const label = col.querySelector('.listing-orbit-label')?.textContent.trim()
    const btn = col.querySelector('.listing-add-toggle')
    return { label, btn: box(btn) }
  })
  return {
    toggles,
    plus: box(plus),
    sheet: box(sheet),
    scrim: scrim && {
      bg: getComputedStyle(scrim).backgroundColor,
      backdrop: getComputedStyle(scrim).backdropFilter || getComputedStyle(scrim).webkitBackdropFilter,
    },
  }
})
console.log('after', JSON.stringify(after))
await shot('thrft_create_add_overlay_blur')

const deltas = before.triggers.map((t, i) => {
  const a = after.toggles[i]?.btn
  return {
    label: t.label,
    dx: a ? a.x - t.btn.x : null,
    dy: a ? a.y - t.btn.y : null,
    dw: a ? a.w - t.btn.w : null,
    dh: a ? a.h - t.btn.h : null,
  }
})
const plusChromeGone =
  after.plus &&
  (after.plus.bg === 'rgba(0, 0, 0, 0)' || after.plus.bg === 'transparent') &&
  after.plus.border === '0px'
const scrimNotDark = after.scrim && !/rgba\(4,\s*4,\s*4/.test(after.scrim.bg)
const sheetBlurry = after.sheet && /blur\(/.test(after.sheet.backdrop || '')
const aligned = deltas.every((d) => Math.abs(d.dx) <= 2 && Math.abs(d.dy) <= 2 && Math.abs(d.dw) <= 2 && Math.abs(d.dh) <= 2)
console.log('deltas', JSON.stringify(deltas))
console.log('checks', JSON.stringify({ aligned, plusChromeGone, scrimNotDark, sheetBlurry, plusY: after.plus?.y, brandY: after.toggles[0]?.btn?.y }))

await browser.close()
process.exit(aligned && plusChromeGone && scrimNotDark && sheetBlurry ? 0 : 2)
