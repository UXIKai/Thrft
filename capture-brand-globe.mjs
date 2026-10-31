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
const STORE = '/cursor/stores/bc-01a15d47-c307-7695-9eec-74a83f124e25/media'
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(STORE, { recursive: true })

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
  await page.waitForTimeout(600)
  const file = `${name}.png`
  const dest = path.join(ART, file)
  await page.screenshot({ path: dest, fullPage: false })
  fs.copyFileSync(dest, path.join(STORE, file))
  console.log('saved', file, fs.statSync(dest).size)
}

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
    localStorage.setItem('thrft-session-v1', session.access_token)
  },
  { storageKey, session },
)
await page.reload({ waitUntil: 'networkidle' })
try {
  await page.waitForSelector('nav.tab-bar', { timeout: 12000 })
} catch {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
}

await page.getByRole('button', { name: 'Create', exact: true }).click()
await page.waitForTimeout(700)
await page.getByRole('tab', { name: 'Market' }).click()
await page.waitForTimeout(700)
await shot('thrft_create_brand_plus')

await page.getByRole('button', { name: 'Browse all brands' }).click()
await page.waitForTimeout(800)
await shot('thrft_brand_globe')

const stage = page.locator('.brand-globe-stage')
const box = await stage.boundingBox()
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 - 20, {
    steps: 12,
  })
  await page.mouse.up()
  await page.waitForTimeout(400)
}
await shot('thrft_brand_globe_rotated')

await browser.close()
console.log('done')
