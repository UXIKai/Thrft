import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const MEDIA = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media/show-now'
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
  await page.waitForTimeout(500)
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
      {
        id: 'g-seed',
        kind: 'group',
        title: 'Weekend Drop',
        preview: 'see you',
        time: 'Now',
        initials: 'WD',
        pinned: true,
        members: ['Alex Rivera', 'Sam Lee', 'You'],
        addedAt: 'Just now',
        messages: [],
      },
    ]),
  )
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('nav.tab-bar', { timeout: 20000 })

// Home
await page.getByRole('button', { name: 'Home', exact: true }).click()
await page.waitForTimeout(700)
await shot('thrft_show_home')

// Chat idle (search bottom + raised plus)
await page.getByRole('button', { name: 'Chat', exact: true }).click()
await page.waitForTimeout(800)
await shot('thrft_show_chat')

// Chat compose (+ open, search hidden)
await page.getByRole('button', { name: 'New chat', exact: true }).click()
await page.waitForTimeout(600)
await shot('thrft_show_chat_compose')

// Chat group flow
await page.getByRole('button', { name: 'Create group', exact: true }).click()
await page.waitForTimeout(700)
await shot('thrft_show_chat_group')

// Close sheet
await page.getByRole('button', { name: 'Close', exact: true }).click().catch(async () => {
  await page.getByRole('button', { name: 'New chat' }).click().catch(() => {})
})
await page.waitForTimeout(400)

// Create
await page.getByRole('button', { name: 'Create', exact: true }).click()
await page.waitForTimeout(800)
await shot('thrft_show_create')

// Saved / Favorites
await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(900)
await shot('thrft_show_favorites')

// Brand globe
await page.getByRole('button', { name: 'Open brand globe', exact: true }).click()
await page.waitForTimeout(1400)
await shot('thrft_show_globe')
await page.getByRole('button', { name: 'Close brand globe', exact: true }).click().catch(() => {})
await page.waitForTimeout(500)

// Profile
await page.getByRole('button', { name: 'Profile', exact: true }).click()
await page.waitForTimeout(900)
await shot('thrft_show_profile')

// Money
await page.getByRole('button', { name: 'Open Money', exact: true }).click()
await page.waitForTimeout(800)
await shot('thrft_show_money')
await page
  .locator('.profile-money-panel button[aria-label="Close"], .profile-money-panel .chat-top-btn, .profile-money-panel button')
  .first()
  .click()
  .catch(async () => {
    await page.keyboard.press('Escape')
  })
await page.waitForTimeout(500)

// Settings
await page.getByRole('button', { name: 'Settings', exact: true }).click()
await page.waitForTimeout(800)
await shot('thrft_show_settings')

await browser.close()
console.log('ALL_OK')
