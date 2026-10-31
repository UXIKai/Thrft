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
const password = 'cloud-cloud-cloud'

const STORE = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(STORE, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const client = createClient(url, pub, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: sign, error: signErr } = await client.auth.signInWithPassword({ email, password })
if (signErr || !sign?.session) {
  console.error('signin failed', signErr?.message)
  process.exit(1)
}
const session = sign.session

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
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
try {
  await page.waitForSelector('nav.tab-bar', { timeout: 15000 })
} catch {
  const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first()
  const passInput = page.locator('input[type="password"]').first()
  if (await emailInput.count()) {
    await emailInput.fill(email)
    await passInput.fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
  }
}

await page.getByRole('button', { name: 'Profile', exact: true }).click()
await page.waitForTimeout(800)
const settingsBtn = page.locator('button[aria-label="Settings"], button:has-text("Settings")').first()
await settingsBtn.click()
await page.waitForSelector('.settings-screen', { timeout: 10000 })
await page.waitForTimeout(900)

const effectCount = await page.locator('.settings-effect-row, .settings-effect-wheel').count()
const colorRow = await page.locator('.settings-color-row').count()
const wheels = await page.locator('.settings-color-wheel').count()
console.log(JSON.stringify({ effectCount, colorRow, wheels }))

const dest = path.join(STORE, 'thrft_settings_no_bg_wheels.png')
await page.screenshot({ path: dest, fullPage: false })
fs.copyFileSync(dest, path.join(ART, 'thrft_settings_no_bg_wheels.png'))
console.log('saved', dest)

await browser.close()
if (effectCount !== 0) process.exit(2)
