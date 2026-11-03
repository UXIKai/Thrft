import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { fetchAccountPage, initialsFromName } from '../api.js'
import './GlassOverlay.css'
import './AccountPage.css'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

export default function AccountPage({
  username,
  onClose,
  onOpenProduct,
  isOwn = false,
}) {
  const [stageEl, setStageEl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [products, setProducts] = useState([])

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAccountPage(username)
        if (cancelled) return
        setAccount(data.account)
        setProducts(Array.isArray(data.products) ? data.products : [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Account not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (username) load()
    return () => {
      cancelled = true
    }
  }, [username])

  if (!stageEl) return null

  const name = account?.displayName || username || 'Account'
  const handle = account?.username || username || ''

  return createPortal(
    <div
      className="glass-overlay account-page"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} account`}
    >
      <header className="glass-overlay-top">
        <button
          type="button"
          className="glass-overlay-back"
          aria-label="Back"
          onClick={onClose}
        >
          <BackIcon />
        </button>
        <h1 className="glass-overlay-title">{isOwn ? 'Your page' : 'Account'}</h1>
        <span className="glass-overlay-spacer" aria-hidden />
      </header>
      <div className="glass-overlay-body">
        {loading && <p className="account-page-muted">Loading…</p>}
        {!loading && error && <p className="account-page-muted">{error}</p>}
        {!loading && !error && account && (
          <>
            <div className="account-page-hero glass-pane-card">
              <span
                className={`account-page-avatar${account.avatarUrl ? ' has-photo' : ''}`}
                aria-hidden
              >
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" />
                ) : (
                  initialsFromName(name)
                )}
              </span>
              <p className="account-page-name">{name}</p>
              <p className="account-page-handle">@{handle}</p>
              {account.bio ? <p className="account-page-bio">{account.bio}</p> : null}
              {account.joined ? (
                <p className="account-page-joined">Joined {account.joined}</p>
              ) : null}
            </div>

            <h2 className="account-page-section-label">Store</h2>
            {products.length === 0 ? (
              <p className="account-page-muted">
                {isOwn ? 'Post a product from Create (+).' : 'No products yet.'}
              </p>
            ) : (
              <ul className="account-page-list">
                {products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="account-page-row"
                      onClick={() =>
                        onOpenProduct?.({
                          id: p.id,
                          title: p.title,
                          price: p.price,
                          brand: p.brand,
                          category: p.category,
                          condition: p.condition,
                          description: p.description,
                          seller: name,
                          sellerUsername: handle,
                        })
                      }
                    >
                      <span className="account-page-row-title">{p.title}</span>
                      <span className="account-page-row-meta">
                        {[p.brand, p.price].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>,
    stageEl,
  )
}
