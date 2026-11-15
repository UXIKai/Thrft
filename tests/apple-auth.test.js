import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('Apple sign-in uses Supabase with the current origin and reports provider errors', async () => {
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY
  const previousWindow = globalThis.window
  process.env.VITE_SUPABASE_URL = 'https://auth.example.com'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
  globalThis.window = { location: { origin: 'https://thrft.example' } }
  const server = await createServer({ configFile: false, server: { middlewareMode: true } })
  try {
    const { getSupabase } = await server.ssrLoadModule('/supabase.js')
    const { signInWithOAuthProvider } = await server.ssrLoadModule('/auth.js')
    const client = getSupabase()
    let options
    client.auth.signInWithOAuth = async (value) => {
      options = value
      return { data: { url: 'https://apple.example' }, error: null }
    }
    assert.deepEqual(await signInWithOAuthProvider('apple'), {
      redirecting: true, url: 'https://apple.example',
    })
    assert.deepEqual(options, { provider: 'apple', options: { redirectTo: 'https://thrft.example' } })
    client.auth.signInWithOAuth = async () => ({ error: { message: 'Apple unavailable' } })
    await assert.rejects(signInWithOAuthProvider('apple'), /Apple unavailable/)
  } finally {
    await server.close()
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
