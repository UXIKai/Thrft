import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA =
  '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media/ui-shots'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(n) {
  await page.waitForTimeout(350)
  const f = `${n}.png`
  await page.screenshot({ path: path.join(ART, f) })
  fs.copyFileSync(path.join(ART, f), path.join(MEDIA, f))
  console.log('saved', f)
}

function measureBar(barSel, backSel, plusSel) {
  return page.evaluate(
    ({ barSel, backSel, plusSel }) => {
      const bar = document.querySelector(barSel)
      const back = document.querySelector(backSel)
      const plus = document.querySelector(plusSel)
      if (!bar || !back || !plus) {
        return { ok: false, missing: { bar: !bar, back: !back, plus: !plus } }
      }
      const b = bar.getBoundingClientRect()
      const bk = back.getBoundingClientRect()
      const p = plus.getBoundingClientRect()
      const pad = 16
      const viewport = window.innerWidth
      const backInside =
        bk.left >= b.left - 1 &&
        bk.right <= b.right + 1 &&
        bk.top >= b.top - 1 &&
        bk.bottom <= b.bottom + 1
      const plusInside =
        p.left >= b.left - 1 &&
        p.right <= b.right + 1 &&
        p.top >= b.top - 1 &&
        p.bottom <= b.bottom + 1
      const backChip =
        getComputedStyle(back).borderRadius !== '0px' &&
        parseFloat(getComputedStyle(back).width) >= 30
      const plusChip =
        getComputedStyle(plus).borderRadius !== '0px' &&
        parseFloat(getComputedStyle(plus).width) >= 30
      return {
        ok: true,
        barLeft: b.left,
        barRight: b.right,
        barWidth: b.width,
        viewport,
        fullBleedish: Math.abs(b.left - pad) <= 2 && Math.abs(viewport - pad - b.right) <= 2,
        backInside,
        plusInside,
        backChip,
        plusChip,
        backParentIsBar: back.closest(barSel) === bar,
        plusParentIsBar: plus.closest(barSel) === bar,
      }
    },
    { barSel, backSel, plusSel },
  )
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.locator('input[type=email]').first().fill('cloud@thrft.local')
await page.locator('input[type=password]').first().fill('cloud-cloud-cloud')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })

// Seed a DM so compose bar is reachable, then reload so ChatScreen mounts with it
await page.evaluate(() => {
  const chat = {
    id: 'seed-dm-alex',
    kind: 'dm',
    title: 'Alex Rivera',
    initials: 'AR',
    preview: 'hey',
    time: 'now',
    pinned: false,
    messages: [{ id: 'm1', from: 'them', text: 'hey', at: Date.now() }],
  }
  localStorage.setItem('thrft-chats-v1', JSON.stringify([chat]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('nav.tab-bar', { timeout: 25000 })
await page.getByRole('button', { name: 'Chat', exact: true }).click()
await page.waitForTimeout(700)
const chat = await measureBar(
  '.chat-search-bar',
  '.chat-dock-back',
  '.chat-search-add',
)
console.log('chat', JSON.stringify(chat))
await shot('23-chat-chips-in-bar')

// Open a DM for compose bar
await page.locator('button.chat-row').first().click({ force: true })
await page.waitForSelector('.chat-compose-box', { timeout: 15000 })
await page.waitForTimeout(500)
const compose = await page.evaluate(() => {
  const box = document.querySelector('.chat-compose-box')
  const plus = document.querySelector('.chat-compose-plus')
  const send = document.querySelector('.chat-compose-send')
  if (!box || !plus || !send) {
    return { ok: false, missing: { box: !box, plus: !plus, send: !send } }
  }
  const b = box.getBoundingClientRect()
  const p = plus.getBoundingClientRect()
  const s = send.getBoundingClientRect()
  const thread = document.querySelector('.chat-thread')
  const t = thread?.getBoundingClientRect()
  return {
    ok: true,
    boxWidth: b.width,
    threadInner: t ? t.width - 32 : null,
    fullWidth: t ? Math.abs(b.width - (t.width - 32)) <= 4 : null,
    plusInside:
      p.left >= b.left - 1 &&
      p.right <= b.right + 1 &&
      p.top >= b.top - 1 &&
      p.bottom <= b.bottom + 1,
    sendInside:
      s.left >= b.left - 1 &&
      s.right <= b.right + 1 &&
      s.top >= b.top - 1 &&
      s.bottom <= b.bottom + 1,
    plusChip: parseFloat(getComputedStyle(plus).borderRadius) >= 8,
    sendChip: parseFloat(getComputedStyle(send).borderRadius) >= 8,
  }
})
console.log('compose', JSON.stringify(compose))
await shot('24-dm-compose-chips-in-bar')
await page.getByRole('button', { name: 'Add attachment' }).click()
await page.waitForTimeout(400)
await shot('25-dm-compose-attach-open')

await page.getByRole('button', { name: 'Back to chats' }).click()
await page.waitForSelector('.chat-search-bar', { timeout: 10000 })
// Chat/Saved hide the tab bar — dock Back returns Home first
await page.locator('.chat-dock-back').click()
await page.waitForSelector('nav.tab-bar', { timeout: 10000 })

// Favorites (Saved tab)
await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(700)
const saved = await measureBar(
  '.saved-search-bar',
  '.saved-dock-back',
  '.saved-search-add',
)
console.log('saved', JSON.stringify(saved))
await shot('26-favorites-chips-in-bar')

// Favorites keeps search in the dock bar (already measured). Home Brand/Type
// pickers host back/+ inside BrandGlobe's full-width search.
await page.locator('.saved-dock-back').click()
await page.waitForSelector('nav.tab-bar', { timeout: 10000 })

// Open Home brand picker (same BrandGlobe search chrome as Create)
await page.getByRole('button', { name: 'Open brands' }).click()
await page.waitForSelector('.brand-globe-search', { timeout: 15000 })
await page.waitForTimeout(600)
const globe = await measureBar(
  '.brand-globe-search',
  '.brand-globe-dock-back',
  '.brand-globe-dock-plus',
)
console.log('globe', JSON.stringify(globe))
await shot('27-brand-globe-chips-in-bar')

await browser.close()

const fails = []
for (const [name, m] of [
  ['chat', chat],
  ['saved', saved],
  ['globe', globe],
]) {
  if (!m.ok) fails.push(`${name} missing ${JSON.stringify(m.missing)}`)
  else {
    if (!m.fullBleedish) fails.push(`${name} not full width ${m.barLeft}-${m.barRight}/${m.viewport}`)
    if (!m.backInside || !m.plusInside) fails.push(`${name} chips outside bar`)
    if (!m.backChip || !m.plusChip) fails.push(`${name} chips lack container`)
    if (!m.backParentIsBar || !m.plusParentIsBar) fails.push(`${name} chips not nested in bar`)
  }
}
if (!compose.ok) fails.push(`compose missing ${JSON.stringify(compose.missing)}`)
else {
  if (!compose.plusInside || !compose.sendInside) fails.push('compose chips outside box')
  if (!compose.plusChip || !compose.sendChip) fails.push('compose chips lack container')
  if (compose.fullWidth === false) fails.push('compose not full width')
}

if (fails.length) {
  console.error('FAIL', fails)
  process.exit(1)
}
console.log('OK')
