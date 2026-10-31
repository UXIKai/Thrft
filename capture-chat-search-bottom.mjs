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

await page.evaluate(() => {
  localStorage.setItem(
    'thrft-chats-v1',
    JSON.stringify([
      {
        id: 'dm-seed',
        kind: 'dm',
        title: 'Alex Rivera',
        preview: 'hey',
        time: 'Now',
        initials: 'AR',
        pinned: false,
        addedAt: 'Just now',
        messages: [],
      },
    ]),
  )
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('nav.tab-bar', { timeout: 20000 })

await page.getByRole('button', { name: 'Chat', exact: true }).click()
await page.waitForTimeout(700)

const idle = await page.evaluate(() => {
  const dock = document.querySelector('.chat-bottom-dock')
  const search = document.querySelector('.chat-search-bar')
  const plus = document.querySelector('.chat-search-add')
  const topSearch = document.querySelector('.chat-search-top')
  if (!dock || !search || !plus) return { ok: false }
  const d = dock.getBoundingClientRect()
  const s = search.getBoundingClientRect()
  const p = plus.getBoundingClientRect()
  return {
    ok: true,
    topSearchPresent: Boolean(topSearch),
    searchVisible: s.height > 0 && getComputedStyle(search).display !== 'none',
    plusAboveSearch: p.bottom <= s.top + 1,
    gapPx: Math.round(s.top - p.bottom),
    searchBottom: Math.round(s.bottom),
    dockBottom: Math.round(d.bottom),
    viewport: window.innerHeight,
  }
})
console.log('idle', JSON.stringify(idle))
await shot('chat_search_bottom_idle')

await page.getByRole('button', { name: 'New chat', exact: true }).click()
await page.waitForTimeout(600)

const open = await page.evaluate(() => {
  const search = document.querySelector('.chat-search-bar')
  const plus = document.querySelector('.chat-search-add')
  const sheet = document.querySelector('.chat-sheet')
  const p = plus?.getBoundingClientRect()
  return {
    searchPresent: Boolean(search),
    sheetPresent: Boolean(sheet),
    plusRotated: plus?.classList.contains('is-sheet-open') || false,
    plusBottom: p ? Math.round(p.bottom) : null,
    viewport: window.innerHeight,
  }
})
console.log('open', JSON.stringify(open))
await shot('chat_search_bottom_plus_open')

await browser.close()

if (!idle.ok || idle.topSearchPresent || !idle.searchVisible || !idle.plusAboveSearch) {
  console.error('FAIL idle layout')
  process.exit(1)
}
if (open.searchPresent || !open.sheetPresent || !open.plusRotated) {
  console.error('FAIL open layout — search should hide when + pressed')
  process.exit(1)
}
console.log('OK')
