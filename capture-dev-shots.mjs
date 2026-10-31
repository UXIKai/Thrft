import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

function loadEnv(file) {
  const out = {}
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
const email = 'tour@thrft.local'
const password = 'tour-tour-tour'

const OUT = '/tmp/thrft-shots/out'
const STORE = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media/dev-now'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(OUT, { recursive: true })
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

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})

async function shot(name) {
  await page.waitForTimeout(700)
  const file = `${name}.png`
  const dest = path.join(OUT, file)
  await page.screenshot({ path: dest, fullPage: false })
  fs.copyFileSync(dest, path.join(STORE, file))
  fs.copyFileSync(dest, path.join(ART, `thrft_dev_${file}`))
  console.log('saved', file)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await shot('01-auth')

// Inject Supabase session into localStorage the way @supabase/supabase-js expects
const projectRef = new URL(url).hostname.split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`
await page.evaluate(
  ({ storageKey, session }) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      }),
    )
  },
  { storageKey, session },
)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// Wait until tab bar appears (signed in)
try {
  await page.waitForSelector('nav.tab-bar', { timeout: 15000 })
} catch {
  await shot('01b-auth-still')
  console.error('tab bar missing — still on auth?')
  // try UI login as fallback
  const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first()
  const passInput = page.locator('input[type="password"]').first()
  if (await emailInput.count()) {
    await emailInput.fill(email)
    await passInput.fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
  }
}

await shot('02-home')

async function goTab(label) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(900)
}

await goTab('Chat')
await shot('03-chat')

await goTab('Create')
await shot('04-create')

await goTab('Saved')
await shot('05-saved')

await goTab('Profile')
await shot('06-profile')

// Settings from profile if present
const settingsBtn = page.locator('button[aria-label="Settings"], button:has-text("Settings")').first()
if (await settingsBtn.count()) {
  await settingsBtn.click()
  await page.waitForTimeout(900)
  await shot('07-settings')
  const back = page.locator('button[aria-label="Back"]').first()
  if (await back.count()) await back.click()
  await page.waitForTimeout(500)
}

// Bag from home
await goTab('Home')
const bag = page.locator('button[aria-label*="Bag"], button[aria-label*="bag"], button[aria-label*="Cart"]').first()
if (await bag.count()) {
  await bag.click()
  await page.waitForTimeout(900)
  await shot('08-bag')
}

await browser.close()
console.log('done')
EOF
node /tmp/thrft-shots/capture.mjs
