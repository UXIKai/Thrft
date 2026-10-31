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

const STORE = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(STORE, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

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
console.log('got session for', session.user.email)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(name) {
  await page.waitForTimeout(600)
  const dest = path.join(STORE, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  fs.copyFileSync(dest, path.join(ART, `${name}.png`))
  console.log('saved', name)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
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
  await page.waitForSelector('nav.tab-bar', { timeout: 8000 })
} catch {
  const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first()
  const passInput = page.locator('input[type="password"]').first()
  if (await emailInput.count()) {
    await emailInput.fill(email)
    await passInput.fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
  } else {
    console.error('not signed in')
    process.exit(1)
  }
}

await page.locator('nav.tab-bar button').last().click()
await page.waitForTimeout(900)

const openSpaces = page.getByRole('button', {
  name: /Open Store, Wardrobe, and Closet/i,
})
if (await openSpaces.count()) {
  await openSpaces.click()
} else {
  // fallback: unified plus / spaces entry on profile
  const fallback = page.locator(
    'button[aria-label*="Store" i], .profile-unified-plus, .profile-spaces-entry',
  )
  console.log('openSpaces missing; fallback count', await fallback.count())
  if (await fallback.count()) await fallback.first().click()
}
await page.waitForTimeout(900)

const closetTab = page.getByRole('tab', { name: 'Closet' })
if (await closetTab.count()) {
  await closetTab.click()
} else {
  const modes = page.locator('.profile-panel-mode')
  console.log('closet tab missing; modes', await modes.count())
  if ((await modes.count()) >= 3) await modes.nth(2).click()
}
await page.waitForTimeout(1200)

const plus = page.locator('button.closet-wheel-add, button[aria-label="Add category"]').first()
const plusCount = await plus.count()
console.log('closet-wheel-add count', plusCount)
if (plusCount) {
  await plus.scrollIntoViewIfNeeded()
}
await shot('thrft_closet_type_add_plus')

await browser.close()
console.log('done')
