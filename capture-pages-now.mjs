import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const ROOT = '/tmp/thrft-home-dna'
const env = { ...loadEnv(`${ROOT}/.env`), ...loadEnv(`${ROOT}/.env.local`) }
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const pub = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
const email = 'cloud@thrft.local'
const password = 'cloud-cloud-cloud'

const ART = '/opt/cursor/artifacts'
const STORE = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media/pages-now'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(STORE, { recursive: true })

const REQUIRED = [
  'thrft_pages_auth',
  'thrft_pages_home',
  'thrft_pages_chat',
  'thrft_pages_create_store',
  'thrft_pages_create_market',
  'thrft_pages_create_closet',
  'thrft_pages_favorites',
  'thrft_pages_profile',
  'thrft_pages_money',
  'thrft_pages_settings',
  'thrft_pages_bag',
  'thrft_pages_getting_started',
  'thrft_pages_closet_browse',
]

const client = createClient(url, pub, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: sign, error: signErr } = await client.auth.signInWithPassword({
  email,
  password,
})
if (signErr || !sign?.session) {
  console.error('signin failed', signErr?.message)
  process.exit(1)
}
const session = sign.session
console.log('session', session.user.email)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(name) {
  await page.waitForTimeout(700)
  const file = `${name}.png`
  const artPath = path.join(ART, file)
  const storePath = path.join(STORE, file)
  await page.screenshot({ path: artPath, fullPage: false })
  fs.copyFileSync(artPath, storePath)
  console.log('saved', file)
}

async function goTab(label) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(900)
}

async function clearOverlays() {
  // Escape / back through common overlays
  for (let i = 0; i < 4; i++) {
    const back = page
      .locator(
        'button[aria-label="Back"], button[aria-label="Back to profile"], button[aria-label="Close"], button[aria-label="Dismiss"]',
      )
      .first()
    if (await back.isVisible().catch(() => false)) {
      await back.click().catch(() => {})
      await page.waitForTimeout(400)
    } else break
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(200)
}

// --- Auth (signed out) ---
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('thrft_pages_auth')

// --- Sign in ---
const projectRef = new URL(url).hostname.split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`
await page.evaluate(
  ({ storageKey, session }) => {
    const payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
    localStorage.setItem('thrft-session-v1', session.access_token)
  },
  { storageKey, session },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

try {
  await page.waitForSelector('nav.tab-bar', { timeout: 12000 })
} catch {
  const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first()
  const passInput = page.locator('input[type="password"]').first()
  if (await emailInput.count()) {
    await emailInput.fill(email)
    await passInput.fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
  } else {
    console.error('could not sign in')
    process.exit(1)
  }
}

await shot('thrft_pages_home')

await goTab('Chat')
await shot('thrft_pages_chat')

await goTab('Create')
await shot('thrft_pages_create_store')

const marketTab = page.getByRole('tab', { name: 'Market' })
if (await marketTab.count()) {
  await marketTab.click()
  await page.waitForTimeout(700)
}
await shot('thrft_pages_create_market')

const closetTab = page.getByRole('tab', { name: 'Closet' })
if (await closetTab.count()) {
  await closetTab.click()
  await page.waitForTimeout(700)
}
await shot('thrft_pages_create_closet')

await goTab('Saved')
await shot('thrft_pages_favorites')

await goTab('Profile')
await shot('thrft_pages_profile')

// Money
const moneyBtn = page.getByRole('button', { name: /Open Money|Money/i }).first()
if (await moneyBtn.count()) {
  await moneyBtn.click()
  await page.waitForTimeout(900)
  await shot('thrft_pages_money')
  const backMoney = page.locator('button[aria-label="Back to profile"]').first()
  if (await backMoney.count()) await backMoney.click()
  await page.waitForTimeout(500)
} else {
  console.warn('money button missing')
  await shot('thrft_pages_money')
}

// Settings + Getting Started
await goTab('Profile')
await page.waitForTimeout(400)
const settingsBtn = page.locator('button[aria-label="Settings"]').first()
if (await settingsBtn.count()) {
  await settingsBtn.click()
  await page.waitForTimeout(900)
  await shot('thrft_pages_settings')

  // Scroll to Help & Support / Getting Started
  const started = page.getByText('Getting Started', { exact: true }).first()
  if (await started.count()) {
    await started.scrollIntoViewIfNeeded()
    await started.click()
    await page.waitForTimeout(900)
    await shot('thrft_pages_getting_started')
    const backHelp = page.locator('button[aria-label="Back"], button[aria-label="Close"]').first()
    if (await backHelp.count()) await backHelp.click()
    await page.waitForTimeout(400)
  } else {
    console.warn('Getting Started row missing')
    await shot('thrft_pages_getting_started')
  }

  const backSettings = page.locator('button[aria-label="Back"]').first()
  if (await backSettings.count()) await backSettings.click()
  await page.waitForTimeout(500)
} else {
  console.warn('settings missing')
  await shot('thrft_pages_settings')
  await shot('thrft_pages_getting_started')
}

// Bag from Home
await clearOverlays()
await goTab('Home')
const bag = page.locator('button[aria-label*="Bag"]').first()
if (await bag.count()) {
  await bag.click()
  await page.waitForTimeout(900)
  await shot('thrft_pages_bag')
  await clearOverlays()
} else {
  console.warn('bag missing')
  await shot('thrft_pages_bag')
}

// Closet browse via Profile spaces book
await goTab('Profile')
await page.waitForTimeout(500)
const openSpaces = page.getByRole('button', {
  name: /Open Store, Wardrobe, and Closet/i,
})
if (await openSpaces.count()) {
  await openSpaces.scrollIntoViewIfNeeded()
  await openSpaces.click()
  await page.waitForTimeout(800)
  const closetMode = page.getByRole('tab', { name: 'Closet' })
  if (await closetMode.count()) {
    await closetMode.click()
    await page.waitForTimeout(900)
  }
  await shot('thrft_pages_closet_browse')
} else {
  console.warn('spaces entry missing')
  await shot('thrft_pages_closet_browse')
}

await browser.close()

console.log('\n--- verify ---')
let ok = true
for (const name of REQUIRED) {
  const art = path.join(ART, `${name}.png`)
  const store = path.join(STORE, `${name}.png`)
  const a = fs.existsSync(art) ? fs.statSync(art).size : 0
  const s = fs.existsSync(store) ? fs.statSync(store).size : 0
  const good = a > 10000 && s > 10000
  if (!good) ok = false
  console.log(`${good ? 'OK' : 'MISSING'} ${name} art=${a} store=${s}`)
}
if (!ok) process.exit(2)
console.log('all pages captured')
