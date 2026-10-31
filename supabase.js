import { createClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 * Reads from Vite env (.env / .env.local):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (new dashboard name)
 *   VITE_SUPABASE_ANON_KEY         (legacy alias — same key)
 */
function readEnv(name) {
  return String(import.meta.env[name] || '').trim()
}

const url = readEnv('VITE_SUPABASE_URL')
const publishable =
  readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  readEnv('VITE_SUPABASE_ANON_KEY') ||
  readEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY')

export function getSupabaseConfig() {
  return {
    url,
    publishableKey: publishable,
    configured: Boolean(url && publishable),
  }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured
}

let client = null

/** Lazy singleton — always uses current import.meta.env values. */
export function getSupabase() {
  if (client) return client
  const cfg = getSupabaseConfig()
  if (!cfg.configured) return null
  client = createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'thrft-supabase-auth',
      flowType: 'pkce',
    },
  })
  return client
}

/** @deprecated prefer getSupabase() */
export const supabase = typeof window !== 'undefined' ? getSupabase() : null

export function supabaseConfigError() {
  return new Error('Auth unavailable')
}
