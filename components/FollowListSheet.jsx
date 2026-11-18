import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { fetchFollowList, initialsFromName } from '../api.js'
import './FollowListSheet.css'

export default function FollowListSheet({ username, type, isOwn = false, onClose, onOpenAccount }) {
  const [state, setState] = useState({ loading: true, error: '', private: false, accounts: [] })

  useEffect(() => {
    let alive = true
    setState({ loading: true, error: '', private: false, accounts: [] })
    fetchFollowList(username, type)
      .then((data) => { if (alive) setState({ loading: false, error: '', ...data }) })
      .catch((error) => { if (alive) setState({ loading: false, error: error.message || 'Could not load', private: false, accounts: [] }) })
    return () => { alive = false }
  }, [username, type])

  const title = type === 'following' ? 'Following' : 'Followers'
  let body
  if (state.loading) body = <p className="follow-sheet-muted">Loading…</p>
  else if (state.error) body = <p className="follow-sheet-muted" role="alert">{state.error}</p>
  else if (state.private) body = <p className="follow-sheet-muted">@{username} keeps who they follow private.</p>
  else if (!state.accounts.length) {
    body = <p className="follow-sheet-muted">{type === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}</p>
  } else {
    body = (
      <ul className="follow-sheet-list">
        {state.accounts.map((account) => (
          <li key={account.username}>
            <button type="button" className="follow-sheet-row is-bare"
              onClick={() => { onClose(); onOpenAccount?.(account.username) }}>
              <span className={`follow-sheet-avatar${account.avatarUrl ? ' has-photo' : ''}`} aria-hidden>
                {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : initialsFromName(account.displayName || account.username)}
              </span>
              <span className="follow-sheet-name">@{account.username}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return createPortal(
    <div className="follow-sheet-backdrop" onClick={onClose}>
      <div className="follow-sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="follow-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="follow-sheet-close is-bare" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {isOwn && type === 'following' && !state.loading && !state.error && (
          <p className="follow-sheet-hint">Change who can see this in Settings.</p>
        )}
        {body}
      </div>
    </div>,
    document.body,
  )
}
