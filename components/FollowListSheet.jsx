import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { fetchFollowList, initialsFromName, setFollowingAccount } from '../api.js'
import './GlassOverlay.css'
import './FollowListSheet.css'

const SORTS = [
  { id: 'default', label: 'Default' },
  { id: 'latest', label: 'Date followed: latest' },
  { id: 'earliest', label: 'Date followed: earliest' },
]

const EMPTY = { loading: true, error: '', private: false, accounts: [] }

export default function FollowListSheet({ username, type: initialType, onClose, onOpenAccount }) {
  const [stageEl, setStageEl] = useState(null)
  const [type, setType] = useState(initialType)
  const [lists, setLists] = useState({ followers: EMPTY, following: EMPTY })
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => {
    const stage = document.querySelector('.stage')
    setStageEl(stage)
    const added = stage && !stage.classList.contains('is-overlay-open')
    stage?.classList.add('is-overlay-open')
    return () => { if (added) stage.classList.remove('is-overlay-open') }
  }, [])

  useEffect(() => {
    let alive = true
    for (const kind of ['followers', 'following']) {
      fetchFollowList(username, kind)
        .then((data) => alive && setLists((prev) => ({ ...prev, [kind]: { loading: false, error: '', ...data } })))
        .catch((error) => alive && setLists((prev) => ({ ...prev,
          [kind]: { ...EMPTY, loading: false, error: error.message || 'Could not load' } })))
    }
    return () => { alive = false }
  }, [username])

  const current = lists[type]
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const found = current.accounts.filter((a) => !needle
      || a.username.toLowerCase().includes(needle) || (a.displayName || '').toLowerCase().includes(needle))
    const time = (a) => Date.parse(a.followedAt) || 0
    if (sort === 'latest') return [...found].sort((a, b) => time(b) - time(a))
    if (sort === 'earliest') return [...found].sort((a, b) => time(a) - time(b))
    return [...found].sort((a, b) => a.username.localeCompare(b.username))
  }, [current, query, sort])

  async function toggleFollow(account) {
    const follow = !account.following
    const patch = (value) => setLists((prev) => Object.fromEntries(Object.entries(prev).map(([kind, list]) => [kind,
      { ...list, accounts: list.accounts.map((a) => a.username === account.username ? { ...a, following: value } : a) }])))
    patch(follow)
    try { await setFollowingAccount(account.username, follow) } catch { patch(!follow) }
  }

  const count = (kind) => (lists[kind].loading || lists[kind].private ? '' : `${lists[kind].accounts.length} `)
  let body
  if (current.loading) body = <p className="follow-page-muted">Loading…</p>
  else if (current.error) body = <p className="follow-page-muted" role="alert">{current.error}</p>
  else if (current.private) body = <p className="follow-page-muted">@{username} keeps who they follow private.</p>
  else if (!rows.length) {
    body = <p className="follow-page-muted">{query ? 'No matches.' : type === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}</p>
  } else {
    body = (
      <ul className="follow-page-list">
        {rows.map((a) => (
          <li key={a.username} className="follow-page-row">
            <button type="button" className="follow-page-person is-bare"
              onClick={() => { onClose(); onOpenAccount?.(a.username) }}>
              <span className={`follow-page-avatar${a.avatarUrl ? ' has-photo' : ''}`} aria-hidden>
                {a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : initialsFromName(a.displayName || a.username)}
              </span>
              <span className="follow-page-names">
                <span className="follow-page-user">{a.username}</span>
                {a.displayName && a.displayName !== a.username && <span className="follow-page-display">{a.displayName}</span>}
              </span>
            </button>
            {!a.isSelf && (
              <button type="button" className="follow-page-action" onClick={() => toggleFollow(a)}>
                {a.following ? 'Following' : 'Follow'}
              </button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  if (!stageEl) return null
  return createPortal(
    <div className="glass-overlay follow-page" role="dialog" aria-modal="true" aria-label="Followers and following">
      <div className="follow-page-top">
        <button type="button" className="follow-page-back is-bare" aria-label="Back" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5.5 8.5 12 15 18.5" /></svg>
        </button>
        <h2>{username}</h2>
      </div>
      <div className="follow-page-tabs" role="tablist">
        {['followers', 'following'].map((kind) => (
          <button key={kind} type="button" role="tab" aria-selected={type === kind}
            className={`follow-page-tab is-bare${type === kind ? ' is-active' : ''}`}
            onClick={() => setType(kind)}>{count(kind)}{kind}</button>
        ))}
      </div>
      <div className="follow-page-scroll">
        <input className="follow-page-search" type="search" placeholder="Search username or display name"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="follow-page-sort">
          <span>Sort by <strong>{SORTS.find((s) => s.id === sort).label}</strong></span>
          <button type="button" className="is-bare" aria-label="Sort" onClick={() => setSortOpen(true)}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4v16M4.5 16.5 8 20l3.5-3.5M16 20V4M12.5 7.5 16 4l3.5 3.5" /></svg>
          </button>
        </div>
        {body}
      </div>
      {sortOpen && (
        <div className="follow-page-sort-backdrop" onClick={() => setSortOpen(false)}>
          <div className="follow-page-sort-sheet" role="dialog" aria-label="Sort by" onClick={(e) => e.stopPropagation()}>
            <h3>Sort by</h3>
            {SORTS.map((option) => (
              <button key={option.id} type="button" className="follow-page-sort-option is-bare"
                role="radio" aria-checked={sort === option.id}
                onClick={() => { setSort(option.id); setSortOpen(false) }}>
                <span>{option.label}</span>
                <span className={`follow-page-radio${sort === option.id ? ' is-on' : ''}`} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    stageEl,
  )
}
