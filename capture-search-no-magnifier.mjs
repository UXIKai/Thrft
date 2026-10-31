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
  await page.waitForTimeout(400)
  const file = `${name}.png`
  const dest = path.join(ART, file)
  await page.screenshot({ path: dest, fullPage: false })
  fs.copyFileSync(dest, path.join(STORE, file))
  console.log('saved', file)
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
const projectRef = new URL(url).hostname.split('.')[0]
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
  { storageKey: `sb-${projectRef}-auth-token`, session },
)
await page.reload({ waitUntil: 'networkidle' })
try {
  await page.waitForSelector('nav.tab-bar', { timeout: 8000 })
} catch {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForSelector('nav.tab-bar', { timeout: 20000 })
}

await page.getByRole('button', { name: 'Saved', exact: true }).click()
await page.waitForTimeout(800)

const icoCount = await page.locator('.saved-dock-search-ico, .saved-search-bar svg').count()
console.log('favorites search svg count', icoCount)

await shot('thrft_search_no_magnifier')

// Also verify chat add sheet has no magnifier (secondary evidence)
await page.getByRole('button', { name: 'Chat', exact: true }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: /new chat|open composer|Add|compose/i }).first().click().catch(async () => {
  await page.locator('.chat-search-add').click()
})
await page.waitForTimeout(700)
const chatIco = await page.locator('.chat-friend-search svg, .chat-friend-search .chat-ico').count()
console.log('chat friend search svg count', chatIco)
await shot('thrft_search_no_magnifier_chat')

await browser.close()
console.log('done')
