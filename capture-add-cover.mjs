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
  await page.waitForTimeout(400)
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

await page.getByRole('button', { name: 'Create', exact: true }).click()
await page.waitForTimeout(600)
// Market has Brand + Type wheels
await page.getByRole('tab', { name: 'Market', exact: true }).click()
await page.waitForTimeout(700)
await shot('thrft_create_wheels_idle')

await page.getByRole('button', { name: 'Add brand or type', exact: true }).click()
await page.waitForTimeout(500)

function visibleOrbit() {
  return page.evaluate(() => {
    const orbits = [...document.querySelectorAll('.listing-orbit')]
    return orbits
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        const col = el.closest('.listing-wheel-col')
        return (
          r.width > 0 &&
          r.height > 0 &&
          st.visibility !== 'hidden' &&
          st.display !== 'none' &&
          !col?.hasAttribute('hidden')
        )
      })
      .map((el) => el.getAttribute('aria-label') || el.className)
  })
}

const openState = await page.evaluate(() => {
  const wheels = document.querySelector('.listing-wheels')
  const sheet = document.querySelector('.listing-add-sheet')
  const plus = document.querySelector('.listing-wheel-add')
  return {
    adding: wheels?.classList.contains('is-adding') || false,
    sheet: Boolean(sheet),
    plusOpen: plus?.classList.contains('is-open') || false,
    plusLabel: plus?.getAttribute('aria-label') || null,
  }
})
const openOrbits = await visibleOrbit()
console.log('open', JSON.stringify({ ...openState, openOrbits }))
await shot('thrft_create_add_cover')

// Close via plus again
await page.getByRole('button', { name: 'Close add brand or type', exact: true }).click()
await page.waitForTimeout(400)
const closed = await page.evaluate(() => ({
  adding: document.querySelector('.listing-wheels')?.classList.contains('is-adding') || false,
  sheet: Boolean(document.querySelector('.listing-add-sheet')),
}))
const closedOrbits = await visibleOrbit()
console.log('closed', JSON.stringify({ ...closed, closedOrbits }))
await shot('thrft_create_wheels_after_close')

// Open and add a type
await page.getByRole('button', { name: 'Add brand or type', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Type', exact: true }).click()
await page.getByRole('textbox', { name: 'Type name' }).fill('Windbreakers')
await page.getByRole('button', { name: 'Add type to wheel', exact: true }).click()
await page.waitForTimeout(500)
const afterAdd = await page.evaluate(() => ({
  adding: document.querySelector('.listing-wheels')?.classList.contains('is-adding') || false,
  sheet: Boolean(document.querySelector('.listing-add-sheet')),
}))
const afterOrbits = await visibleOrbit()
console.log('afterAdd', JSON.stringify({ ...afterAdd, afterOrbits }))
await shot('thrft_create_after_add')

await browser.close()

if (!openState.adding || !openState.sheet || openOrbits.length > 0) {
  console.error('FAIL wheels should be covered/hidden while adding', openState, openOrbits)
  process.exit(1)
}
if (closed.adding || closed.sheet || closedOrbits.length < 1) {
  console.error('FAIL plus should restore wheels', closed, closedOrbits)
  process.exit(1)
}
if (afterAdd.adding || afterAdd.sheet || afterOrbits.length < 1) {
  console.error('FAIL add should restore wheels', afterAdd, afterOrbits)
  process.exit(1)
}
console.log('OK')
