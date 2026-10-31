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
  await page.waitForTimeout(450)
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
        id: 'dm-seed-2',
        kind: 'dm',
        title: 'Sam Lee',
        preview: '',
        time: 'Now',
        initials: 'SL',
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
await page.waitForTimeout(800)

await page.getByRole('button', { name: 'New chat', exact: true }).click()
await page.waitForTimeout(600)

await page.getByRole('button', { name: 'Create group', exact: true }).click()
await page.waitForTimeout(700)

async function measure(label) {
  const gap = await page.evaluate(() => {
    const suggest = document.querySelector('.chat-member-suggest')
    const actions = document.querySelector('.chat-sheet-actions')
    const block = document.querySelector('.chat-members-block')
    const field = document.querySelector('.chat-member-field')
    if (!suggest || !actions || !block) return null
    const s = suggest.getBoundingClientRect()
    const a = actions.getBoundingClientRect()
    const b = block.getBoundingClientRect()
    const f = field?.getBoundingClientRect()
    return {
      suggestH: Math.round(s.height),
      gapFieldToActions: f ? Math.round(a.top - f.bottom) : null,
      gapBlockToActions: Math.round(a.top - b.bottom),
      suggestMinH: getComputedStyle(suggest).minHeight,
      open: suggest.classList.contains('is-open'),
    }
  })
  console.log(label, JSON.stringify(gap))
}

await measure('empty')
await shot('thrft_members_space_empty')

const memberInput = page.getByRole('textbox', { name: 'Add member' })
await memberInput.click()
await memberInput.fill('Al')
await page.waitForTimeout(700)

const dropdownVisible = await page
  .locator('.chat-member-results .chat-friend-row')
  .first()
  .isVisible()
  .catch(() => false)
console.log('dropdownVisible', dropdownVisible)
console.log(
  'options',
  await page.locator('.chat-member-results .chat-friend-name').allTextContents(),
)

await measure('open')
await shot('thrft_members_dropdown')

const alex = page.locator('.chat-member-results .chat-friend-row').filter({ hasText: 'Alex Rivera' }).first()
if (await alex.count()) {
  await alex.click()
} else {
  await page.locator('.chat-member-results .chat-friend-row').first().click()
}
await page.waitForTimeout(500)
await shot('thrft_members_added')

await browser.close()
console.log('done')
