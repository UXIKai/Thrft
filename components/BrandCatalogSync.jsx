import { useState } from 'react'
import { importBrandUrl } from '../api.js'

export default function BrandCatalogSync({ brandId, disabled = false, onSynced }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function sync() {
    if (busy) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await importBrandUrl({ brandId })
      setMessage(`${result.imported} products synced.${result.complete ? '' : ' Partial catalog; other products were kept.'}`)
      await onSynced?.()
    } catch (err) {
      setError(err.message || 'Could not sync catalog. Please retry.')
    } finally { setBusy(false) }
  }
  return <div>
    <button type="button" disabled={disabled || busy} onClick={sync}>
      {busy ? 'Syncing catalog...' : 'Sync / Re-import catalog'}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}
