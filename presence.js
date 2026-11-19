import { getSupabase } from './supabase.js'

// Who is in the app right now, via a Supabase Realtime presence channel.
let channel = null
let currentId = ''
let count = 0
const listeners = new Set()

function publish(n) {
  count = n
  listeners.forEach((fn) => fn(n))
}

export function startPresence(accountId) {
  const id = String(accountId || '')
  if (id === currentId) return
  stopPresence()
  const sb = getSupabase()
  if (!id || !sb) return
  currentId = id
  const ch = sb.channel('thrft-online', { config: { presence: { key: id } } })
  ch.on('presence', { event: 'sync' }, () => publish(Object.keys(ch.presenceState()).length))
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') ch.track({ at: Date.now() })
  })
  channel = ch
}

export function stopPresence() {
  if (channel) getSupabase()?.removeChannel(channel)
  channel = null
  currentId = ''
  publish(0)
}

export function onlineCount() {
  return count
}

export function subscribePresence(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
