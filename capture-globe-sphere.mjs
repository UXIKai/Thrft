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

function labelUprightStats() {
  return page.evaluate(() => {
    const focus = document.querySelector('.brand-globe-focus')
    const shell = [...document.querySelectorAll('.brand-globe-world .brand-globe-label')]
    const readUp = (el) => {
      const inline = el.style.transform || ''
      const r = el.getBoundingClientRect()
      // translate3d-only labels are screen-upright; height stays readable.
      return {
        text: el.textContent,
        upright: /translate3d\(/.test(inline) && !/rotateX|rotateZ|matrix3d/.test(inline),
        h: r.height,
        w: r.width,
        ratio: r.width / Math.max(1, r.height),
      }
    }
    return {
      focusText: focus?.textContent || null,
      shell: shell.map(readUp),
      shellCount: shell.length,
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
await page.waitForTimeout(1200)

const idle = await labelUprightStats()
console.log('idle', JSON.stringify(idle))
await shot('thrft_globe_sphere_front')

const stage = page.locator('.brand-globe-stage')
const box = await stage.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// Heavy pitch — previously flipped words upside-down
await page.mouse.move(cx, cy - 20)
await page.mouse.down()
await page.mouse.move(cx, cy + 150, { steps: 18 })
await page.mouse.up()
await page.waitForTimeout(600)

const pitched = await labelUprightStats()
console.log('pitched', JSON.stringify(pitched))
await shot('thrft_globe_sphere_turned')

await page.mouse.move(cx - 40, cy)
await page.mouse.down()
await page.mouse.move(cx + 120, cy, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(500)
const yawed = await labelUprightStats()
console.log('yawed', JSON.stringify(yawed))
await shot('thrft_globe_sphere_wheel')

await browser.close()

const flipped = [...pitched.shell, ...yawed.shell].filter((s) => !s.upright || s.h < 8)
if (!idle.focusText || idle.shellCount < 3) {
  console.error('FAIL missing focus/shell', idle)
  process.exit(1)
}
if (flipped.length > 0) {
  console.error('FAIL shell labels not upright', flipped)
  process.exit(1)
}
if (yawed.focusText === idle.focusText && pitched.focusText === idle.focusText) {
  console.error('FAIL focus did not cycle', {
    idle: idle.focusText,
    pitched: pitched.focusText,
    yawed: yawed.focusText,
  })
  process.exit(1)
}
console.log('OK')
