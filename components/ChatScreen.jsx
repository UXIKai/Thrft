import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSaved } from '../api.js'
import BrandGlobe from './BrandGlobe.jsx'
import './ChatScreen.css'

const CHATS_KEY = 'thrft-chats-v1'
const FRIENDS_KEY = 'thrft-friends-v1'

function readStoredFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((n) => String(n || '').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function writeStoredFriends(list) {
  try {
    localStorage.setItem(
      FRIENDS_KEY,
      JSON.stringify(Array.isArray(list) ? list : []),
    )
  } catch {
    /* ignore */
  }
}

function normalizeChat(chat) {
  if (!chat || typeof chat !== 'object') return null
  const messages = Array.isArray(chat.messages)
    ? chat.messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .map((m) => {
          const kind =
            m.kind === 'image' || m.kind === 'file' || m.kind === 'liked'
              ? m.kind
              : 'text'
          const next = {
            id: String(m.id || `m-${Math.random().toString(36).slice(2, 9)}`),
            kind,
            text: String(m.text).trim(),
            from: m.from === 'them' ? 'them' : 'me',
            at: Number(m.at) || Date.now(),
          }
          if (kind === 'image' && typeof m.imageUrl === 'string') {
            next.imageUrl = m.imageUrl
            next.fileName = String(m.fileName || m.text || 'Photo')
          }
          if (kind === 'file') {
            next.fileName = String(m.fileName || m.text || 'File')
          }
          if (kind === 'liked' && m.liked && typeof m.liked === 'object') {
            next.liked = {
              title: String(m.liked.title || ''),
              brandName: String(m.liked.brandName || ''),
              code: String(m.liked.code || ''),
            }
          }
          return next
        })
    : []
  return { ...chat, messages }
}

function readStoredChats() {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeChat).filter(Boolean)
  } catch {
    return []
  }
}

function writeStoredChats(list) {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(Array.isArray(list) ? list : []))
  } catch {
    /* ignore */
  }
}

function formatMsgTime(ts) {
  if (!ts) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function PlusIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
      />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg className="chat-dots-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

function PinIcon({ className = 'chat-menu-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16 9V4h1V2H7v2h1v5l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
      />
    </svg>
  )
}

function CheckCircleIcon({ className = 'chat-pins-menu-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.2 12.2 2.4 2.4 5.2-5.4"
      />
    </svg>
  )
}

function PersonCircleIcon({ className = 'chat-pins-menu-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.35" fill="currentColor" />
      <path
        fill="currentColor"
        d="M7.6 17.2c.7-2.1 2.4-3.1 4.4-3.1s3.7 1 4.4 3.1H7.6z"
      />
    </svg>
  )
}

function TrashIcon({ className = 'chat-contact-action-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M9.2 3.5h5.6l.6 1.2h3.4v1.8H5.2V4.7h3.4l.6-1.2zM6.8 8.2h10.4l-.75 12.1A1.6 1.6 0 0 1 14.86 21.8H9.14a1.6 1.6 0 0 1-1.59-1.5L6.8 8.2zm2.3 2.1v8.2h1.7v-8.2H9.1zm3.8 0v8.2h1.7v-8.2H12.9z"
      />
    </svg>
  )
}

function BlockIcon({ className = 'chat-contact-action-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm0 1.8a7.7 7.7 0 0 0-5.7 12.85l10.85-10.85A7.66 7.66 0 0 0 12 4.3zm5.7 2.55L6.85 18.7A7.7 7.7 0 0 0 17.7 6.85z"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 5.2 12 10.8l5.6-5.6 1.2 1.2L13.2 12l5.6 5.6-1.2 1.2L12 13.2l-5.6 5.6-1.2-1.2L10.8 12 5.2 6.4l1.2-1.2z"
      />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg className="chat-ico chat-people-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8" r="2.4" fill="currentColor" />
      <circle cx="16.2" cy="8.6" r="2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M3.8 18.4c.4-3 2.6-4.6 5.2-4.6s4.8 1.6 5.2 4.6H3.8zm8.7-.2c.5-1.7 1.8-3.4 4.1-3.4 2.2 0 3.7 1.4 4.1 3.4h-8.2z"
      />
    </svg>
  )
}

function emptyPinnedSlots(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `slot-${i}`, empty: true }))
}

function PencilIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M4.5 16.8 15.2 6.1a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.2 20.5H4.5v-3.7z"
      />
    </svg>
  )
}

function FilterIcon({ className = 'chat-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4 7h16M7 12h10M10 17h4"
      />
    </svg>
  )
}

function FilterCheckIcon() {
  return (
    <svg className="chat-filter-menu-check" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12.5 4.2 4.2L19 7"
      />
    </svg>
  )
}

function FilterMessagesIcon() {
  return (
    <svg className="chat-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4.2 5.5h9.1c1.1 0 2 .9 2 2v5.2c0 1.1-.9 2-2 2H9.1L5.8 17.8V14.7H4.2c-1.1 0-2-.9-2-2V7.5c0-1.1.9-2 2-2z"
      />
      <path
        fill="currentColor"
        d="M10.8 9.2h9c1.1 0 2 .9 2 2v5.2c0 1.1-.9 2-2 2h-1.5v3.1l-3.3-3.1H10.8c-1.1 0-2-.9-2-2v-5.2c0-1.1.9-2 2-2z"
        opacity="0.92"
      />
    </svg>
  )
}

function FilterUnknownIcon() {
  return (
    <svg className="chat-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8.2" r="3.2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M5.6 19.2c.9-3.1 3.2-4.7 6.4-4.7s5.5 1.6 6.4 4.7"
      />
      <circle cx="7.2" cy="16.6" r="3.3" fill="currentColor" />
      <text
        x="7.2"
        y="17.15"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1a1a1a"
        fontSize="4.6"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        ?
      </text>
    </svg>
  )
}

function FilterSpamIcon() {
  return (
    <svg className="chat-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4.5 8.2h15v10.3a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4.5 8.2 12 3.8l7.5 4.4"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="m9.2 12.2 5.6 5.6M14.8 12.2l-5.6 5.6"
      />
    </svg>
  )
}

function FilterTrashIcon() {
  return (
    <svg className="chat-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 7.5h13M9.2 7.5V5.8a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v1.7M8 7.5l.7 11.2a1.4 1.4 0 0 0 1.4 1.3h4a1.4 1.4 0 0 0 1.4-1.3L16 7.5"
      />
    </svg>
  )
}

const CHAT_FILTER_OPTIONS = [
  { id: 'messages', label: 'Messages', Icon: FilterMessagesIcon },
  { id: 'unknown', label: 'Unknown Senders', Icon: FilterUnknownIcon },
  { id: 'spam', label: 'Spam', Icon: FilterSpamIcon },
  { id: 'deleted', label: 'Recently Deleted', Icon: FilterTrashIcon },
]

function BackIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
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

function SendIcon() {
  return (
    <svg className="chat-compose-send-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19V5M5.5 11.5 12 5l6.5 6.5"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="chat-liked-search-ico" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="10.5"
        cy="10.5"
        r="6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="m15.4 15.4 4.2 4.2"
      />
    </svg>
  )
}

function LikedHeartIcon({ className = 'chat-liked-hero-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 20.4S3.6 15.1 3.6 9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.4 2.5c0 5.4-8.4 10.7-8.4 10.7z"
      />
    </svg>
  )
}

function likedItemKey(item) {
  return String(item?.id || item?.code || item?.title || '')
}

function ImageAttachIcon() {
  return (
    <svg className="chat-compose-attach-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V8a1.5 1.5 0 0 1 1.5-1.5z"
      />
      <circle cx="9" cy="10.5" r="1.35" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7.2 17.2 3.4-3.6 2.4 2.2 3.1-3.5 3.2 4.9"
      />
    </svg>
  )
}

function HeartAttachIcon() {
  return (
    <svg className="chat-compose-attach-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 20.4S3.6 15.1 3.6 9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.4 2.5c0 5.4-8.4 10.7-8.4 10.7z"
      />
    </svg>
  )
}

function FileAttachIcon() {
  return (
    <svg className="chat-compose-attach-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3.8h5.2L18.5 9v11.2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.2 3.8V9H18.5"
      />
    </svg>
  )
}

function ChatBubbleIcon({ className = 'chat-member-action-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 4.2h15a1.8 1.8 0 0 1 1.8 1.8v9.2a1.8 1.8 0 0 1-1.8 1.8H11l-3.8 3.2c-.7.6-1.7.1-1.7-.8v-2.4H4.5A1.8 1.8 0 0 1 2.7 15.2V6A1.8 1.8 0 0 1 4.5 4.2zm1.7 3.4v1.8h11.6V7.6H6.2zm0 3.6v1.8h8.2v-1.8H6.2z"
      />
    </svg>
  )
}

function MinusIcon({ className = 'chat-member-action-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M5.2 11h13.6v2H5.2z"
      />
    </svg>
  )
}

function usernameForName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .slice(0, 24)
}

export default function ChatScreen({
  onBack,
  onOpenAccount,
  onThreadActiveChange,
} = {}) {
  const [chats, setChats] = useState(() => readStoredChats())
  const [memberDraft, setMemberDraft] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [query, setQuery] = useState('')
  const [composer, setComposer] = useState(null) // null | { mode: 'create'|'edit', chatId? }
  const [draftName, setDraftName] = useState('')
  const [draftMembers, setDraftMembers] = useState([])
  const [friendQuery, setFriendQuery] = useState('')
  const [findUsersOpen, setFindUsersOpen] = useState(false)
  const [usersPickerOpen, setUsersPickerOpen] = useState(false)
  const [usersQuery, setUsersQuery] = useState('')
  const [friends, setFriends] = useState(() => readStoredFriends())
  const [groupSelected, setGroupSelected] = useState(false)
  const [memberGlobeOpen, setMemberGlobeOpen] = useState(false)
  const [memberGlobePhase, setMemberGlobePhase] = useState('closed')
  const [memberSearch, setMemberSearch] = useState('')
  const [groupNameStep, setGroupNameStep] = useState(false)
  const memberGlobeVisible =
    memberGlobeOpen && memberGlobePhase !== 'closed'

  // Hide the bottom nav while the group-members globe is up.
  useEffect(() => {
    const stage = document.querySelector('.stage')
    if (!stage) return undefined
    stage.classList.toggle('is-member-globe-open', memberGlobeVisible)
    return () => stage.classList.remove('is-member-globe-open')
  }, [memberGlobeVisible])
  const [menuPos, setMenuPos] = useState(null) // { top, right } viewport coords
  const [activeChatId, setActiveChatId] = useState(null)
  const [contactSheetOpen, setContactSheetOpen] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')
  const [peerProfile, setPeerProfile] = useState(null) // { name, initials }
  const [membersSheetOpen, setMembersSheetOpen] = useState(false)
  const [memberNameDrafts, setMemberNameDrafts] = useState({})
  const [draftMessage, setDraftMessage] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [likedPickerOpen, setLikedPickerOpen] = useState(false)
  const [likedItems, setLikedItems] = useState([])
  const [likedQuery, setLikedQuery] = useState('')
  const [likedSelected, setLikedSelected] = useState([]) // item keys, max 10
  const [pinsMenuOpen, setPinsMenuOpen] = useState(false)
  const [pinsMode, setPinsMode] = useState(null) // null | 'select' | 'pins' | 'profile'
  const [pinSelectedIds, setPinSelectedIds] = useState([])
  const [listFilterOpen, setListFilterOpen] = useState(false)
  const [listFilter, setListFilter] = useState('messages')
  const pinsMenuRef = useRef(null)
  const listFilterRef = useRef(null)
  const menuRef = useRef(null)
  const dotsRefs = useRef(new Map())
  const friendSearchRef = useRef(null)
  const nickInputRef = useRef(null)
  const threadScrollRef = useRef(null)
  const composeInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const attachWrapRef = useRef(null)
  const activeChat = chats.find((c) => c.id === activeChatId) || null
  const threadMessages = activeChat?.messages || []
  const managedMembers = useMemo(() => {
    if (!activeChat || activeChat.kind !== 'group') return []
    return (activeChat.members || []).filter((m) => m && m !== 'You')
  }, [activeChat])

  const pinned = useMemo(() => chats.filter((c) => c.pinned), [chats])

  const allMemberNames = useMemo(() => {
    const names = new Set()
    for (const c of chats) {
      if (c?.kind === 'dm' && c.title) names.add(String(c.title))
      if (Array.isArray(c?.members)) {
        for (const m of c.members) {
          if (m && m !== 'You') names.add(String(m))
        }
      }
    }
    // Seed a few demo contacts so the globe isn't empty on a fresh account.
    for (const seed of [
      'Alex Rivera',
      'Jordan Lee',
      'Sam Patel',
      'Casey Nguyen',
      'Riley Brooks',
      'Morgan Diaz',
      'Quinn Harper',
      'Avery Chen',
    ]) {
      names.add(seed)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [chats])

  const memberGlobeItems = useMemo(() => {
    const q = groupNameStep ? '' : memberSearch.trim().toLowerCase()
    const selected = new Set(draftMembers.map((m) => m.toLowerCase()))
    let list = allMemberNames.filter((n) => !selected.has(n.toLowerCase()))
    // Only real contacts — never invent a typed name that isn't in the list
    if (q) {
      list = list.filter((n) => n.toLowerCase().includes(q))
    }
    return list.slice(0, 36).map((name) => ({ id: name, label: name }))
  }, [allMemberNames, draftMembers, memberSearch, groupNameStep])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (c) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.preview.toLowerCase().includes(q)
    return {
      pinned: pinned.filter(match),
      // Keep pinned rows in the list too so ··· can unpin
      all: chats.filter(match),
    }
  }, [chats, pinned, query])

  const filteredLikedItems = useMemo(() => {
    const q = likedQuery.trim().toLowerCase()
    if (!q) return likedItems
    return likedItems.filter((item) => {
      const hay =
        `${item.title || ''} ${item.brandName || ''} ${item.code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [likedItems, likedQuery])

  const userDirectory = useMemo(() => {
    const byLower = new Map()
    for (const name of allMemberNames) {
      const clean = String(name || '').trim()
      if (!clean) continue
      byLower.set(clean.toLowerCase(), clean)
    }
    for (const name of friends) {
      const clean = String(name || '').trim()
      if (!clean) continue
      if (!byLower.has(clean.toLowerCase())) byLower.set(clean.toLowerCase(), clean)
    }
    return [...byLower.values()].sort((a, b) => a.localeCompare(b))
  }, [allMemberNames, friends])

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase()
    if (!q) return userDirectory
    const hits = userDirectory.filter((n) => n.toLowerCase().includes(q))
    // Allow messaging a typed name that isn't in the directory yet
    if (
      q &&
      !hits.some((n) => n.toLowerCase() === q) &&
      usersQuery.trim()
    ) {
      return [usersQuery.trim(), ...hits]
    }
    return hits
  }, [userDirectory, usersQuery])

  const pinnedCells = useMemo(() => {
    if (filtered.pinned.length === 0) return emptyPinnedSlots(3)
    const cells = [...filtered.pinned]
    const rem = cells.length % 3
    if (rem !== 0) {
      for (let i = 0; i < 3 - rem; i += 1) {
        cells.push({ id: `pad-${cells.length}`, empty: true })
      }
    }
    return cells
  }, [filtered.pinned])

  useEffect(() => {
    writeStoredChats(chats)
  }, [chats])

  useEffect(() => {
    onThreadActiveChange?.(Boolean(activeChatId))
    return () => onThreadActiveChange?.(false)
  }, [activeChatId, onThreadActiveChange])

  useEffect(() => {
    if (!activeChatId) {
      setDraftMessage('')
      setAttachOpen(false)
      setLikedPickerOpen(false)
      return undefined
    }
    const id = requestAnimationFrame(() => {
      const el = threadScrollRef.current
      if (el) el.scrollTop = el.scrollHeight
      composeInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [activeChatId, threadMessages.length])

  useEffect(() => {
    if (!attachOpen) return undefined
    function onDocPointerDown(event) {
      const wrap = attachWrapRef.current
      if (wrap && !wrap.contains(event.target)) {
        setAttachOpen(false)
        setLikedPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [attachOpen])

  useEffect(() => {
    if (!pinsMenuOpen) return undefined
    function onDocPointerDown(event) {
      const wrap = pinsMenuRef.current
      if (wrap && !wrap.contains(event.target)) setPinsMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [pinsMenuOpen])

  useEffect(() => {
    if (!listFilterOpen) return undefined
    function onDocPointerDown(event) {
      const wrap = listFilterRef.current
      if (wrap && !wrap.contains(event.target)) setListFilterOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [listFilterOpen])

  useEffect(() => {
    if (!menuId) {
      setMenuPos(null)
      return undefined
    }
    function place() {
      const el = dotsRefs.current.get(menuId)
      if (!el) return
      const r = el.getBoundingClientRect()
      setMenuPos({
        top: Math.min(r.bottom + 4, window.innerHeight - 220),
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    place()
    function onKey(e) {
      if (e.key === 'Escape') {
        setMenuId(null)
        setMenuPos(null)
      }
    }
    window.addEventListener('resize', place)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', place)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  function openMemberGlobe() {
    setMemberSearch('')
    setGroupNameStep(false)
    setMemberGlobeOpen(true)
    setMemberGlobePhase('enter')
    window.requestAnimationFrame(() => setMemberGlobePhase('open'))
  }

  function closeMemberGlobe() {
    setMemberGlobePhase('exit')
  }

  function onMemberGlobeExitComplete() {
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setMemberSearch('')
    setGroupNameStep(false)
  }

  function onMemberGlobeConfirm() {
    if (!groupNameStep) {
      if (!draftMembers.length) return
      setGroupNameStep(true)
      setDraftName('')
      setMemberSearch('')
      return
    }
    if (!draftName.trim() && !draftMembers.length) return
    // Hard-dismiss now so the globe cannot linger when returning to chat list
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setMemberSearch('')
    setGroupNameStep(false)
    saveComposer()
  }

  function openCreateGroup() {
    setDraftName('')
    setDraftMembers([])
    setMemberDraft('')
    setFriendQuery('')
    setFindUsersOpen(false)
    setGroupSelected(false)
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setMemberSearch('')
    setGroupNameStep(false)
    setComposer({ mode: 'create' })
    setMenuId(null)
    setMenuPos(null)
    setQuery('')
  }

  function onDockPlusClick() {
    if (composer) {
      closeComposer()
      return
    }
    openCreateGroup()
  }

  function openMembersSheet(chat = activeChat) {
    if (!chat || chat.kind !== 'group') return
    const members = (chat.members || []).filter((m) => m && m !== 'You')
    const drafts = {}
    for (const name of members) drafts[name] = name
    setMemberNameDrafts(drafts)
    setPeerProfile(null)
    setContactSheetOpen(false)
    setEditingNick(false)
    setMembersSheetOpen(true)
  }

  function closeMembersSheet() {
    setMembersSheetOpen(false)
    setMemberNameDrafts({})
  }

  function openEditGroup(chat) {
    closeMenus()
    setComposer(null)
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setActiveChatId(chat.id)
    setDraftMessage('')
    openMembersSheet(chat)
  }

  function renameGroupMember(chatId, oldName, nextName) {
    const clean = String(nextName || '').trim()
    if (!clean || clean === 'You' || clean === oldName) {
      setMemberNameDrafts((prev) => ({ ...prev, [oldName]: oldName }))
      return
    }
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId || !Array.isArray(c.members)) return c
        if (c.members.some((m) => m !== oldName && m.toLowerCase() === clean.toLowerCase())) {
          return c
        }
        return {
          ...c,
          members: c.members.map((m) => (m === oldName ? clean : m)),
        }
      }),
    )
    setMemberNameDrafts((prev) => {
      const next = { ...prev }
      delete next[oldName]
      next[clean] = clean
      return next
    })
  }

  function removeGroupMember(chatId, name) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId && Array.isArray(c.members)
          ? { ...c, members: c.members.filter((m) => m !== name) }
          : c,
      ),
    )
    setMemberNameDrafts((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function blockGroupMember(chatId, name) {
    removeGroupMember(chatId, name)
    setChats((prev) =>
      prev.filter(
        (c) =>
          !(
            c.kind === 'dm' &&
            String(c.title || '').toLowerCase() === String(name).toLowerCase()
          ),
      ),
    )
  }

  function messageGroupMember(name) {
    closeMembersSheet()
    startChatWithUser(name)
  }

  function closeComposer() {
    setComposer(null)
    setFriendQuery('')
    setMemberDraft('')
    setFindUsersOpen(false)
    setUsersPickerOpen(false)
    setUsersQuery('')
    setGroupSelected(false)
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setMemberSearch('')
    setGroupNameStep(false)
  }

  function onGroupButtonClick() {
    if (composer?.mode === 'edit') {
      saveComposer()
      return
    }
    if (!groupSelected) {
      setGroupSelected(true)
      setFindUsersOpen(false)
      setUsersPickerOpen(false)
      openMemberGlobe()
      return
    }
    saveComposer()
  }

  function openFindUsers() {
    setGroupSelected(false)
    setFindUsersOpen(true)
    setMemberGlobeOpen(false)
    setMemberGlobePhase('closed')
    setUsersQuery('')
    setUsersPickerOpen(true)
  }

  function closeUsersPicker() {
    setUsersPickerOpen(false)
    setUsersQuery('')
  }

  function isFriend(name) {
    const key = String(name || '').trim().toLowerCase()
    return friends.some((f) => f.toLowerCase() === key)
  }

  function toggleFriend(name) {
    const clean = String(name || '').trim()
    if (!clean) return
    setFriends((prev) => {
      const key = clean.toLowerCase()
      const next = prev.some((f) => f.toLowerCase() === key)
        ? prev.filter((f) => f.toLowerCase() !== key)
        : [...prev, clean]
      writeStoredFriends(next)
      return next
    })
  }

  function startChatWithUser(name) {
    const clean = String(name || '').trim()
    if (!clean) return
    const existing = chats.find(
      (c) => c.kind === 'dm' && c.title.toLowerCase() === clean.toLowerCase(),
    )
    let openId = existing?.id
    if (!existing) {
      openId = `dm-${Date.now()}`
      const initials = clean
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
      setChats((prev) => [
        {
          id: openId,
          kind: 'dm',
          title: clean,
          preview: '',
          time: 'Now',
          initials,
          pinned: false,
          addedAt: 'Just now',
          messages: [],
        },
        ...prev,
      ])
    }
    setComposer(null)
    setFriendQuery('')
    setMemberDraft('')
    setFindUsersOpen(false)
    setUsersPickerOpen(false)
    setUsersQuery('')
    setMembersSheetOpen(false)
    setContactSheetOpen(false)
    setPeerProfile(null)
    setActiveChatId(openId)
    setDraftMessage('')
  }

  function removeMember(name) {
    setDraftMembers((prev) => prev.filter((m) => m !== name))
  }

  function addMember(name) {
    const clean = String(name || '').trim()
    if (!clean) return
    const known = allMemberNames.some(
      (n) => n.toLowerCase() === clean.toLowerCase(),
    )
    if (!known) return
    setDraftMembers((prev) =>
      prev.some((m) => m.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, clean],
    )
    setMemberDraft('')
    setMemberSearch('')
  }

  function saveComposer() {
    const name =
      draftName.trim() ||
      (draftMembers.length
        ? draftMembers.slice(0, 2).join(', ')
        : 'New Group')
    const members = [...draftMembers, 'You']
    let openId = null
    if (composer?.mode === 'create') {
      openId = `g-${Date.now()}`
      setChats((prev) => [
        {
          id: openId,
          kind: 'group',
          title: name,
          preview: '',
          time: 'Now',
          initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() || '')
            .join(''),
          members,
          pinned: false,
          addedAt: 'Just now',
          messages: [],
        },
        ...prev,
      ])
    } else if (composer?.mode === 'edit' && composer.chatId) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === composer.chatId
            ? {
                ...c,
                title: name,
                members,
                initials: name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() || '')
                  .join(''),
              }
            : c,
        ),
      )
    }
    setComposer(null)
    setFriendQuery('')
    setMemberDraft('')
    setFindUsersOpen(false)
    setGroupSelected(false)
    setGroupNameStep(false)
    setMemberSearch('')
    if (openId) {
      setActiveChatId(openId)
      setDraftMessage('')
    }
  }

  function pushThreadMessage(msg, preview) {
    if (!activeChatId || !msg) return
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              messages: [...(c.messages || []), msg],
              preview: preview || msg.text || 'Attachment',
              time: 'Now',
            }
          : c,
      ),
    )
  }

  function sendMessage() {
    const text = draftMessage.trim()
    if (!text || !activeChatId) return
    pushThreadMessage(
      {
        id: `m-${Date.now()}`,
        kind: 'text',
        text,
        from: 'me',
        at: Date.now(),
      },
      text,
    )
    setDraftMessage('')
    setAttachOpen(false)
  }

  function closeAttachMenu() {
    setAttachOpen(false)
    setLikedPickerOpen(false)
    setLikedQuery('')
    setLikedSelected([])
  }

  function sendImageFile(file) {
    if (!file || !activeChatId) return
    const url = URL.createObjectURL(file)
    pushThreadMessage(
      {
        id: `m-${Date.now()}`,
        kind: 'image',
        text: file.name || 'Photo',
        imageUrl: url,
        fileName: file.name || 'Photo',
        from: 'me',
        at: Date.now(),
      },
      'Photo',
    )
    closeAttachMenu()
  }

  function sendFileAttachment(file) {
    if (!file || !activeChatId) return
    pushThreadMessage(
      {
        id: `m-${Date.now()}`,
        kind: 'file',
        text: file.name || 'File',
        fileName: file.name || 'File',
        from: 'me',
        at: Date.now(),
      },
      file.name || 'File',
    )
    closeAttachMenu()
  }

  async function openLikedPicker() {
    setAttachOpen(false)
    setLikedQuery('')
    setLikedSelected([])
    setLikedPickerOpen(true)
    const remote = await fetchSaved().catch(() => [])
    setLikedItems(Array.isArray(remote) ? remote : [])
  }

  function closeLikedPicker() {
    setLikedPickerOpen(false)
    setLikedQuery('')
    setLikedSelected([])
  }

  function toggleLikedSelect(item) {
    const key = likedItemKey(item)
    if (!key) return
    setLikedSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= 10) return prev // silently cap at 10
      return [...prev, key]
    })
  }

  function sendLikedSelection() {
    if (!activeChatId || likedSelected.length === 0) return
    const byKey = new Map(
      likedItems.map((item) => [likedItemKey(item), item]),
    )
    const now = Date.now()
    likedSelected.forEach((key, index) => {
      const item = byKey.get(key)
      if (!item) return
      const label =
        item.brandName || item.title || item.code || 'Liked item'
      pushThreadMessage(
        {
          id: `m-${now}-${index}`,
          kind: 'liked',
          text: label,
          liked: {
            title: item.title || '',
            brandName: item.brandName || '',
            code: item.code || '',
            photoUrl:
              item.photoUrl || item.imageUrl || item.image_url || '',
          },
          from: 'me',
          at: now + index,
        },
        `Liked · ${label}`,
      )
    })
    closeLikedPicker()
    setAttachOpen(false)
  }

  function togglePin(id) {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    )
    closeMenus()
  }

  function closeMenus() {
    setMenuId(null)
    setMenuPos(null)
  }

  function closePinsMenu() {
    setPinsMenuOpen(false)
  }

  function setPinsEditMode(mode) {
    setPinsMode((prev) => (prev === mode ? null : mode))
    setPinsMenuOpen(false)
    if (mode !== 'select') setPinSelectedIds([])
  }

  function onPinnedSlotClick(cell) {
    if (cell.empty) return
    if (pinsMode === 'select') {
      setPinSelectedIds((prev) =>
        prev.includes(cell.id)
          ? prev.filter((id) => id !== cell.id)
          : [...prev, cell.id],
      )
      return
    }
    if (pinsMode === 'pins') {
      togglePin(cell.id)
      return
    }
    if (pinsMode === 'profile') {
      setPinsMode(null)
      if (cell.kind === 'group') {
        setActiveChatId(cell.id)
        setDraftMessage('')
        openMembersSheet(cell)
        return
      }
      setActiveChatId(cell.id)
      setDraftMessage('')
      setNickDraft(cell.title)
      setEditingNick(false)
      setPeerProfile(null)
      setMembersSheetOpen(false)
      setContactSheetOpen(true)
      return
    }
    openThread(cell)
  }

  function initialsFromTitle(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  }

  function openContactSheet() {
    if (!activeChat) return
    setNickDraft(activeChat.title)
    setEditingNick(false)
    setPeerProfile(null)
    setMembersSheetOpen(false)
    setContactSheetOpen(true)
  }

  function closeContactSheet() {
    setContactSheetOpen(false)
    setEditingNick(false)
    setPeerProfile(null)
  }

  /**
   * Profile link — always opens the full contact card (edit name, pin,
   * delete, block). Used for DM titles and every group-member name.
   */
  function openPeerProfile(name) {
    const clean = String(name || '').trim()
    if (!clean || clean === 'You') return
    setMembersSheetOpen(false)
    setContactSheetOpen(false)
    setEditingNick(false)
    setNickDraft(clean)
    setPeerProfile({
      name: clean,
      initials: initialsFromTitle(clean),
      /** Group member vs the active DM title */
      fromGroup: activeChat?.kind === 'group',
    })
  }

  function closePeerProfile() {
    setPeerProfile(null)
    setEditingNick(false)
  }

  function savePeerNickname() {
    const next = nickDraft.trim()
    if (!next || !peerProfile) {
      setEditingNick(false)
      return
    }
    if (peerProfile.fromGroup && activeChat) {
      renameGroupMember(activeChat.id, peerProfile.name, next)
      setPeerProfile((prev) =>
        prev
          ? {
              ...prev,
              name: next,
              initials: initialsFromTitle(next),
            }
          : prev,
      )
    } else if (
      activeChat?.kind === 'dm' &&
      activeChat.title === peerProfile.name
    ) {
      saveNickname()
      setPeerProfile((prev) =>
        prev
          ? {
              ...prev,
              name: next,
              initials: initialsFromTitle(next),
            }
          : prev,
      )
    } else {
      setPeerProfile((prev) =>
        prev
          ? {
              ...prev,
              name: next,
              initials: initialsFromTitle(next),
            }
          : prev,
      )
    }
    setEditingNick(false)
  }

  function pinPeer(name) {
    const clean = String(name || '').trim()
    if (!clean) return
    const existing = chats.find(
      (c) =>
        c.kind === 'dm' &&
        String(c.title || '').toLowerCase() === clean.toLowerCase(),
    )
    if (existing) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === existing.id ? { ...c, pinned: !c.pinned } : c,
        ),
      )
      return
    }
    const initials = initialsFromTitle(clean)
    setChats((prev) => [
      {
        id: `dm-${Date.now()}`,
        kind: 'dm',
        title: clean,
        preview: '',
        time: 'Now',
        initials,
        pinned: true,
        addedAt: 'Just now',
        messages: [],
      },
      ...prev,
    ])
  }

  function peerIsPinned(name) {
    return chats.some(
      (c) =>
        c.kind === 'dm' &&
        c.pinned &&
        String(c.title || '').toLowerCase() === String(name).toLowerCase(),
    )
  }

  function deletePeer(name) {
    if (peerProfile?.fromGroup && activeChat) {
      removeGroupMember(activeChat.id, name)
      closePeerProfile()
      return
    }
    const dm = chats.find(
      (c) =>
        c.kind === 'dm' &&
        String(c.title || '').toLowerCase() === String(name).toLowerCase(),
    )
    if (dm) deleteChat(dm.id)
    else closePeerProfile()
  }

  function blockPeer(name) {
    if (peerProfile?.fromGroup && activeChat) {
      blockGroupMember(activeChat.id, name)
      closePeerProfile()
      return
    }
    const dm = chats.find(
      (c) =>
        c.kind === 'dm' &&
        String(c.title || '').toLowerCase() === String(name).toLowerCase(),
    )
    if (dm) blockChat(dm.id)
    else closePeerProfile()
  }

  function openMenu(chatId) {
    if (menuId === chatId) {
      closeMenus()
      return
    }
    const el = dotsRefs.current.get(chatId)
    if (el) {
      const r = el.getBoundingClientRect()
      setMenuPos({
        top: Math.min(r.bottom + 4, window.innerHeight - 220),
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    setMenuId(chatId)
  }

  function openThread(chat) {
    setActiveChatId(chat.id)
    setDraftMessage('')
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    setNickDraft(chat.title)
    closeMenus()
  }

  function saveNickname() {
    const next = nickDraft.trim()
    if (!next || !activeChatId) {
      setEditingNick(false)
      return
    }
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              title: next,
              initials: next
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() || '')
                .join(''),
            }
          : c,
      ),
    )
    setEditingNick(false)
  }

  function deleteChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id))
    setActiveChatId(null)
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    closeMenus()
  }

  function blockChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id))
    setActiveChatId(null)
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    closeMenus()
  }

  useEffect(() => {
    if ((!contactSheetOpen && !peerProfile) || !editingNick) return undefined
    const id = requestAnimationFrame(() => {
      nickInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [contactSheetOpen, peerProfile, editingNick])

  if (activeChat) {
    return (
      <div className="chat-thread" role="dialog" aria-label={activeChat.title}>
        <header className="chat-thread-top">
          <button
            type="button"
            className="chat-top-btn"
            aria-label="Back to chats"
            onClick={() => {
              setActiveChatId(null)
              setDraftMessage('')
              setAttachOpen(false)
              setLikedPickerOpen(false)
              setContactSheetOpen(false)
              setMembersSheetOpen(false)
              setEditingNick(false)
              setPeerProfile(null)
            }}
          >
            <BackIcon />
          </button>
          <span className="chat-thread-heading" aria-hidden />
          {activeChat.kind === 'group' ? (
            <button
              type="button"
              className="chat-top-btn"
              aria-label="More"
              onClick={openContactSheet}
            >
              <DotsIcon />
            </button>
          ) : (
            <span className="chat-top-spacer" aria-hidden />
          )}
        </header>
        <div className="chat-thread-hero">
          <button
            type="button"
            className="chat-thread-avatar is-link"
            aria-label={
              activeChat.kind === 'dm'
                ? `Open ${activeChat.title} profile`
                : `Open ${activeChat.title} info`
            }
            onClick={() => {
              if (activeChat.kind === 'dm') openPeerProfile(activeChat.title)
              else openContactSheet()
            }}
          >
            {activeChat.initials}
          </button>
          {activeChat.kind === 'dm' ? (
            <button
              type="button"
              className="chat-thread-name is-link"
              onClick={() => openPeerProfile(activeChat.title)}
            >
              {activeChat.title}
            </button>
          ) : (
            <button
              type="button"
              className="chat-thread-name is-link"
              onClick={openContactSheet}
            >
              {activeChat.title}
            </button>
          )}
        </div>
        <div className="chat-thread-scroll" ref={threadScrollRef}>
          <div className="chat-thread-body" aria-live="polite">
            {threadMessages.length === 0 ? (
              <p className="chat-thread-empty" role="status">
                Message {activeChat.title}
              </p>
            ) : (
              threadMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-thread-bubble ${msg.from === 'me' ? 'is-me' : 'is-them'}${
                    msg.kind && msg.kind !== 'text' ? ` is-${msg.kind}` : ''
                  }`}
                >
                  {msg.kind === 'image' && msg.imageUrl ? (
                    <img
                      className="chat-thread-bubble-image"
                      src={msg.imageUrl}
                      alt={msg.fileName || 'Photo'}
                    />
                  ) : null}
                  {msg.kind === 'file' ? (
                    <div className="chat-thread-bubble-file">
                      <FileAttachIcon />
                      <span>{msg.fileName || msg.text || 'File'}</span>
                    </div>
                  ) : null}
                  {msg.kind === 'liked' ? (
                    <div className="chat-thread-bubble-liked">
                      <HeartAttachIcon />
                      <span>
                        {msg.liked?.brandName ||
                          msg.liked?.title ||
                          msg.text ||
                          'Liked item'}
                      </span>
                    </div>
                  ) : null}
                  {(!msg.kind || msg.kind === 'text') && msg.text ? (
                    <p className="chat-thread-bubble-text">{msg.text}</p>
                  ) : null}
                  {msg.at ? (
                    <span className="chat-thread-bubble-time">
                      {formatMsgTime(msg.at)}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <form
          className={`chat-compose${attachOpen ? ' is-attach-open' : ''}`}
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
        >
          {/* Full-width bar; + and send live inside. Attach tray still floats above. */}
          <div className="chat-compose-box" ref={attachWrapRef}>
            <div className="chat-compose-attach">
              {attachOpen ? (
                <div
                  id="chat-compose-attach-tray"
                  className="chat-compose-attach-tray is-open"
                  role="toolbar"
                  aria-label="Attachments"
                >
                  <button
                    type="button"
                    className="chat-compose-attach-btn"
                    aria-label="Photos"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImageAttachIcon />
                  </button>
                  <button
                    type="button"
                    className="chat-compose-attach-btn"
                    aria-label="Liked"
                    onClick={openLikedPicker}
                  >
                    <HeartAttachIcon />
                  </button>
                  <button
                    type="button"
                    className="chat-compose-attach-btn"
                    aria-label="Files"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileAttachIcon />
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={`chat-compose-plus${attachOpen ? ' is-open' : ''}`}
                aria-label={
                  attachOpen ? 'Close attachments' : 'Add attachment'
                }
                aria-expanded={attachOpen}
                aria-controls={
                  attachOpen ? 'chat-compose-attach-tray' : undefined
                }
                onClick={() => {
                  setAttachOpen((open) => {
                    if (open) setLikedPickerOpen(false)
                    return !open
                  })
                }}
              >
                <PlusIcon />
              </button>
            </div>
            <input
              ref={imageInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) sendImageFile(file)
              }}
            />
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) sendFileAttachment(file)
              }}
            />
            <textarea
              id="chat-compose-input"
              ref={composeInputRef}
              className="chat-compose-input"
              rows={1}
              name="thrft_chat_compose"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-form-type="other"
              placeholder=""
              aria-label="Message"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <button
              type="submit"
              className="chat-compose-send"
              aria-label="Send message"
              disabled={!draftMessage.trim()}
            >
              <SendIcon />
            </button>
          </div>
        </form>

        {likedPickerOpen ? (
          <div
            className="chat-liked-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Send liked items"
          >
            <header className="chat-liked-picker-top">
              <button
                type="button"
                className="chat-top-btn"
                aria-label="Close liked items"
                onClick={closeLikedPicker}
              >
                <BackIcon />
              </button>
              <span className="chat-liked-picker-heading" aria-hidden />
              <span className="chat-top-spacer" aria-hidden />
            </header>
            <div className="chat-liked-hero" aria-hidden>
              <LikedHeartIcon />
            </div>
            <div className="chat-liked-grid">
              {filteredLikedItems.length === 0 ? (
                <p className="chat-liked-empty">No liked items yet</p>
              ) : (
                filteredLikedItems.map((item) => {
                  const key = likedItemKey(item)
                  const selected = likedSelected.includes(key)
                  const photo =
                    item.photoUrl || item.imageUrl || item.image_url || ''
                  const showPhoto =
                    photo &&
                    photo !== 'placeholder' &&
                    !/^placeholder$/i.test(photo)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`chat-liked-item${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      aria-label={`${item.brandName || item.title || item.code || 'Liked item'}${selected ? ', selected' : ''}`}
                      onClick={() => toggleLikedSelect(item)}
                    >
                      <span className="chat-liked-item-media" aria-hidden>
                        {showPhoto ? (
                          <img
                            className="chat-liked-item-photo"
                            src={photo}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span className="chat-liked-item-mark">
                            {String(item.code || item.title || '?')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="chat-liked-item-name">
                        {item.brandName || item.title || item.code}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="chat-liked-dock">
              <div className="chat-liked-bar">
                <span className="chat-liked-search-slot" aria-hidden>
                  <SearchIcon />
                </span>
                <input
                  className="chat-liked-search-input"
                  type="text"
                  inputMode="search"
                  name="thrft_liked_search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder=""
                  aria-label="Search liked items"
                  value={likedQuery}
                  onChange={(e) => setLikedQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="chat-liked-send"
                  aria-label="Send selected liked items"
                  disabled={likedSelected.length < 1}
                  onClick={sendLikedSelection}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {contactSheetOpen && !peerProfile && (
          <div
            className="chat-contact-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Edit contact"
          >
            <button
              type="button"
              className="chat-contact-scrim"
              aria-label="Dismiss"
              onClick={closeContactSheet}
            />
            <div className="chat-contact-card">
              <button
                type="button"
                className="chat-contact-close"
                aria-label="Close"
                onClick={closeContactSheet}
              >
                <CloseIcon />
              </button>
              <span className="chat-contact-avatar" aria-hidden>
                {activeChat.initials}
              </span>
              <div className="chat-contact-name-row">
                {editingNick ? (
                  <form
                    className="chat-contact-nick-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveNickname()
                    }}
                  >
                    <input
                      ref={nickInputRef}
                      className="chat-contact-nick-input"
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      aria-label="Name"
                    />
                    <button type="submit" className="chat-contact-nick-save">
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="chat-contact-name-spacer" aria-hidden />
                    {activeChat.kind === 'dm' ? (
                      <button
                        type="button"
                        className="chat-contact-name is-link"
                        onClick={() => openPeerProfile(activeChat.title)}
                      >
                        {activeChat.title}
                      </button>
                    ) : (
                      <p className="chat-contact-name">{activeChat.title}</p>
                    )}
                    <button
                      type="button"
                      className="chat-contact-name-edit"
                      aria-label="Edit name"
                      onClick={() => {
                        setNickDraft(activeChat.title)
                        setEditingNick(true)
                      }}
                    >
                      <PencilIcon />
                    </button>
                  </>
                )}
              </div>
              {activeChat.kind === 'group' && (
                <div className="chat-contact-members-wrap">
                  <button
                    type="button"
                    className="chat-contact-members-open"
                    aria-label="Open members list"
                    onClick={() => openMembersSheet(activeChat)}
                  >
                    Members
                  </button>
                  {managedMembers.length > 0 && (
                    <ul className="chat-contact-members" aria-label="Members">
                      {managedMembers.map((member) => (
                        <li key={member}>
                          <button
                            type="button"
                            className="chat-contact-member-link"
                            onClick={() => openPeerProfile(member)}
                          >
                            {member}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="chat-contact-added">
                Added {activeChat.addedAt || 'recently'}
              </p>
              <div className="chat-contact-actions">
                <button
                  type="button"
                  className={`chat-contact-action${activeChat.pinned ? ' is-on' : ''}`}
                  onClick={() => togglePin(activeChat.id)}
                >
                  <PinIcon className="chat-contact-action-ico" />
                  <span>{activeChat.pinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <button
                  type="button"
                  className="chat-contact-action"
                  onClick={() => deleteChat(activeChat.id)}
                >
                  <TrashIcon />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  className="chat-contact-action is-danger"
                  onClick={() => blockChat(activeChat.id)}
                >
                  <BlockIcon />
                  <span>Block</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {membersSheetOpen && activeChat?.kind === 'group' && (
          <div
            className="chat-members-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Edit group members"
          >
            <button
              type="button"
              className="chat-contact-scrim"
              aria-label="Dismiss"
              onClick={closeMembersSheet}
            />
            <div className="chat-members-card">
              <button
                type="button"
                className="chat-contact-close"
                aria-label="Close"
                onClick={closeMembersSheet}
              >
                <CloseIcon />
              </button>
              <h2 className="chat-members-title">Members</h2>
              <ul className="chat-members-list">
                {managedMembers.length === 0 ? (
                  <li className="chat-members-empty">No members yet</li>
                ) : (
                  managedMembers.map((member) => {
                    const initials = initialsFromTitle(member)
                    const draft = memberNameDrafts[member] ?? member
                    return (
                      <li key={member} className="chat-member-row">
                        <span className="chat-member-avatar" aria-hidden>
                          {initials}
                        </span>
                        <div className="chat-member-body">
                          <label className="chat-member-name-field">
                            <span className="visually-hidden">Edit name</span>
                            <input
                              className="chat-member-name-input"
                              type="text"
                              value={draft}
                              aria-label={`Edit name for ${member}`}
                              onChange={(e) =>
                                setMemberNameDrafts((prev) => ({
                                  ...prev,
                                  [member]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                renameGroupMember(
                                  activeChat.id,
                                  member,
                                  draft,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  e.currentTarget.blur()
                                }
                              }}
                            />
                          </label>
                          <div
                            className="chat-member-actions"
                            role="group"
                            aria-label={`${member} actions`}
                          >
                            <button
                              type="button"
                              className="chat-member-action"
                              aria-label={`Message ${member}`}
                              title="Chat"
                              onClick={() => messageGroupMember(member)}
                            >
                              <ChatBubbleIcon />
                            </button>
                            <button
                              type="button"
                              className="chat-member-action"
                              aria-label={`Remove ${member}`}
                              title="Remove"
                              onClick={() =>
                                removeGroupMember(activeChat.id, member)
                              }
                            >
                              <MinusIcon />
                            </button>
                            <button
                              type="button"
                              className="chat-member-action is-danger"
                              aria-label={`Block ${member}`}
                              title="Block"
                              onClick={() =>
                                blockGroupMember(activeChat.id, member)
                              }
                            >
                              <BlockIcon className="chat-member-action-ico" />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </div>
        )}

        {peerProfile && (
          <div
            className="chat-contact-sheet chat-peer-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${peerProfile.name} profile`}
          >
            <button
              type="button"
              className="chat-contact-scrim"
              aria-label="Dismiss"
              onClick={closePeerProfile}
            />
            <div className="chat-contact-card">
              <button
                type="button"
                className="chat-contact-close"
                aria-label="Close"
                onClick={closePeerProfile}
              >
                <CloseIcon />
              </button>
              <span className="chat-contact-avatar" aria-hidden>
                {peerProfile.initials}
              </span>
              <div className="chat-contact-name-row">
                {editingNick ? (
                  <form
                    className="chat-contact-nick-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      savePeerNickname()
                    }}
                  >
                    <input
                      ref={nickInputRef}
                      className="chat-contact-nick-input"
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      aria-label="Name"
                    />
                    <button type="submit" className="chat-contact-nick-save">
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="chat-contact-name-spacer" aria-hidden />
                    <p className="chat-contact-name">{peerProfile.name}</p>
                    <button
                      type="button"
                      className="chat-contact-name-edit"
                      aria-label="Edit name"
                      onClick={() => {
                        setNickDraft(peerProfile.name)
                        setEditingNick(true)
                      }}
                    >
                      <PencilIcon />
                    </button>
                  </>
                )}
              </div>
              {peerProfile.fromGroup ? (
                <p className="chat-contact-added">Group member</p>
              ) : (
                <p className="chat-contact-added">
                  Added {activeChat?.addedAt || 'recently'}
                </p>
              )}
              <div className="chat-contact-actions">
                <button
                  type="button"
                  className={`chat-contact-action${peerIsPinned(peerProfile.name) ? ' is-on' : ''}`}
                  onClick={() => pinPeer(peerProfile.name)}
                >
                  <PinIcon className="chat-contact-action-ico" />
                  <span>{peerIsPinned(peerProfile.name) ? 'Unpin' : 'Pin'}</span>
                </button>
                <button
                  type="button"
                  className="chat-contact-action"
                  onClick={() => deletePeer(peerProfile.name)}
                >
                  <TrashIcon />
                  <span>{peerProfile.fromGroup ? 'Remove' : 'Delete'}</span>
                </button>
                <button
                  type="button"
                  className="chat-contact-action is-danger"
                  onClick={() => blockPeer(peerProfile.name)}
                >
                  <BlockIcon />
                  <span>Block</span>
                </button>
              </div>
              {peerProfile.fromGroup ? (
                <button
                  type="button"
                  className="chat-contact-message"
                  onClick={() => {
                    closePeerProfile()
                    messageGroupMember(peerProfile.name)
                  }}
                >
                  <ChatBubbleIcon className="chat-contact-action-ico" />
                  <span>Message</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="chat-screen">
      {menuId && (
        <button
          type="button"
          className="chat-menu-scrim"
          aria-label="Dismiss menu"
          onClick={closeMenus}
        />
      )}

      <section
        className={`chat-section chat-pins-section${pinsMode ? ` is-mode-${pinsMode}` : ''}`}
        aria-label="Pinned"
      >
        <div className="chat-list-toolbar" ref={pinsMenuRef}>
          <div className={`chat-pins-edit${pinsMenuOpen ? ' is-open' : ''}`}>
            {pinsMenuOpen ? (
              <div className="chat-pins-menu" role="menu" aria-label="Pinned chat actions">
                <button
                  type="button"
                  role="menuitem"
                  className={`chat-pins-menu-btn${pinsMode === 'select' ? ' is-on' : ''}`}
                  aria-label="Select"
                  aria-pressed={pinsMode === 'select'}
                  onClick={() => setPinsEditMode('select')}
                >
                  <CheckCircleIcon />
                  <span className="chat-pins-menu-label">Select</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`chat-pins-menu-btn${pinsMode === 'pins' ? ' is-on' : ''}`}
                  aria-label="Edit"
                  aria-pressed={pinsMode === 'pins'}
                  onClick={() => setPinsEditMode('pins')}
                >
                  <PinIcon className="chat-pins-menu-ico" />
                  <span className="chat-pins-menu-label">Edit</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`chat-pins-pencil${pinsMode ? ' is-active' : ''}`}
                aria-label="Edit"
                aria-expanded={false}
                aria-haspopup="menu"
                onClick={() => setPinsMenuOpen(true)}
              >
                <PencilIcon />
              </button>
            )}
          </div>
          <h1 className="chat-list-title">messages</h1>
          <div className="chat-filter-wrap" ref={listFilterRef}>
            <button
              type="button"
              className={`chat-filter-btn${listFilterOpen ? ' is-on' : ''}`}
              aria-label="Filter messages"
              aria-expanded={listFilterOpen}
              aria-haspopup="menu"
              onClick={() => setListFilterOpen((open) => !open)}
            >
              <FilterIcon className="chat-filter-ico" />
            </button>
            {listFilterOpen ? (
              <div
                className="chat-filter-menu"
                role="menu"
                aria-label="Message filters"
              >
                {CHAT_FILTER_OPTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={listFilter === id}
                    className={`chat-filter-menu-item${
                      listFilter === id ? ' is-on' : ''
                    }`}
                    onClick={() => {
                      setListFilter(id)
                      setListFilterOpen(false)
                    }}
                  >
                    <span className="chat-filter-menu-check-slot" aria-hidden>
                      {listFilter === id ? <FilterCheckIcon /> : null}
                    </span>
                    <Icon />
                    <span className="chat-filter-menu-label">{label}</span>
                  </button>
                ))}
                <div className="chat-filter-menu-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="chat-filter-menu-item is-manage"
                  onClick={() => setListFilterOpen(false)}
                >
                  <span className="chat-filter-menu-label">Manage Filtering</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="chat-pinned-grid">
          {pinnedCells.map((cell) =>
            cell.empty ? (
              <div key={cell.id} className="chat-pin-slot is-empty" aria-hidden>
                <span className="chat-pin-slot-dash">—</span>
              </div>
            ) : (
              <button
                key={cell.id}
                type="button"
                className={`chat-pin-slot${
                  pinSelectedIds.includes(cell.id) ? ' is-selected' : ''
                }`}
                aria-pressed={
                  pinsMode === 'select'
                    ? pinSelectedIds.includes(cell.id)
                    : undefined
                }
                onClick={() => onPinnedSlotClick(cell)}
              >
                <span className="chat-pin-avatar" aria-hidden>
                  {cell.initials}
                </span>
                <span className="chat-pin-name">{cell.title}</span>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="chat-section" aria-label="Chats">
        <ul className="chat-list">
          {filtered.all.map((chat) => (
            <li
              key={chat.id}
              className={`chat-row-wrap${menuId === chat.id ? ' is-menu-open' : ''}`}
            >
              <button
                type="button"
                className="chat-row"
                onClick={() => openThread(chat)}
              >
                <span className="chat-avatar" aria-hidden>
                  {chat.initials}
                </span>
                <span className="chat-row-copy">
                  <span className="chat-row-top">
                    <span className="chat-row-title">
                      {chat.title}
                      {chat.kind === 'group' && (
                        <span className="chat-group-tag">Group</span>
                      )}
                    </span>
                    <span className="chat-row-time">{chat.time}</span>
                  </span>
                  <span className="chat-row-preview">{chat.preview}</span>
                </span>
              </button>
              <div className="chat-menu-anchor">
                <button
                  type="button"
                  className="chat-dots"
                  aria-label={`More options for ${chat.title}`}
                  aria-expanded={menuId === chat.id}
                  ref={(el) => {
                    if (el) dotsRefs.current.set(chat.id, el)
                    else dotsRefs.current.delete(chat.id)
                  }}
                  onClick={() => openMenu(chat.id)}
                >
                  <DotsIcon />
                </button>
              </div>
            </li>
          ))}
          {filtered.all.length === 0 && (
            <li className="chat-empty-list" aria-hidden />
          )}
        </ul>
      </section>

      <div className={`chat-bottom-dock${composer ? ' is-sheet-open' : ''}`}>
        {/* Full-width bar; back / + live inside as their own chip containers. */}
        <div
          className={`chat-search-bar${composer ? ' is-sheet-open' : ''}`}
        >
          <button
            type="button"
            className="chat-dock-back"
            aria-label="Back"
            onClick={() => onBack?.()}
          >
            <BackIcon />
          </button>
          <input
            id="chat-search-input"
            className={`chat-search-input${composer ? ' is-sheet-hidden' : ''}`}
            type="text"
            inputMode="search"
            name="thrft_chat_search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            placeholder=""
            aria-label="Search chats"
            aria-hidden={composer ? true : undefined}
            tabIndex={composer ? -1 : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && !composer ? (
            <button
              type="button"
              className="chat-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <CloseIcon />
            </button>
          ) : null}
          <button
            type="button"
            className={`chat-search-add${composer ? ' is-sheet-open' : ''}`}
            aria-label={composer ? 'Close' : 'New chat'}
            aria-pressed={Boolean(composer)}
            onClick={onDockPlusClick}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {menuId && menuPos && (
        <div
          ref={menuRef}
          className="chat-menu is-fixed"
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {(() => {
            const chat = chats.find((c) => c.id === menuId)
            if (!chat) return null
            return (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="chat-menu-item"
                  onClick={() => togglePin(chat.id)}
                >
                  <PinIcon />
                  <span>{chat.pinned ? 'Unpin chat' : 'Pin chat'}</span>
                </button>
                {chat.kind === 'group' && (
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-menu-item"
                    onClick={() => openEditGroup(chat)}
                  >
                    <span>Edit group</span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="chat-menu-item"
                  onClick={() => deleteChat(chat.id)}
                >
                  <TrashIcon className="chat-menu-ico" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="chat-menu-item is-danger"
                  onClick={() => blockChat(chat.id)}
                >
                  <BlockIcon className="chat-menu-ico" />
                  <span>Block</span>
                </button>
              </>
            )
          })()}
        </div>
      )}

      {composer && !usersPickerOpen && (
        <div
          className="chat-sheet is-clear"
          role="dialog"
          aria-modal="true"
          aria-label={composer.mode === 'create' ? 'New chat' : 'Edit group'}
        >
          <button
            type="button"
            className="chat-sheet-scrim"
            aria-label="Dismiss"
            onClick={closeComposer}
          />
          <div className="chat-sheet-card is-clear">
            {composer.mode === 'edit' ? (
              <div className="chat-sheet-head">
                <h2 className="chat-sheet-title">Edit group</h2>
                <button
                  type="button"
                  className="chat-top-btn"
                  aria-label="Close"
                  onClick={closeComposer}
                >
                  <CloseIcon />
                </button>
              </div>
            ) : null}

            {groupSelected && composer.mode === 'edit' && (
              <div className="chat-members-block">
                <button
                  type="button"
                  className="chat-members-open"
                  aria-label="Open members globe"
                  onClick={openMemberGlobe}
                >
                  Members
                </button>
                <div className="chat-member-grid">
                  {draftMembers.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="chat-member-chip is-on"
                      aria-pressed
                      onClick={() => removeMember(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {composer.mode === 'create' ? (
              <div className="chat-sheet-actions">
                <button
                  type="button"
                  className={`chat-sheet-save is-half is-icon${groupSelected ? ' is-on' : ''}`}
                  aria-label={groupSelected ? 'Save group' : 'Create group'}
                  aria-pressed={groupSelected}
                  onClick={onGroupButtonClick}
                >
                  <PeopleIcon />
                </button>
                <button
                  type="button"
                  className={`chat-sheet-find${usersPickerOpen || (findUsersOpen && !groupSelected) ? ' is-on' : ''}`}
                  aria-label="Find friends and chats"
                  aria-pressed={usersPickerOpen || (findUsersOpen && !groupSelected)}
                  onClick={openFindUsers}
                >
                  <PlusIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="chat-sheet-save" onClick={saveComposer}>
                Save changes
              </button>
            )}
          </div>
        </div>
      )}

      {usersPickerOpen ? (
        <div
          className="chat-users-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Find friends and chats"
        >
          <header className="chat-users-picker-top">
            <button
              type="button"
              className="chat-top-btn"
              aria-label="Back"
              onClick={closeUsersPicker}
            >
              <BackIcon />
            </button>
            <span className="chat-users-picker-heading" aria-hidden />
            <span className="chat-top-spacer" aria-hidden />
          </header>
          <div className="chat-users-hero" aria-hidden>
            <PeopleIcon />
          </div>
          <ul className="chat-users-list">
            {filteredUsers.length === 0 ? (
              <li className="chat-users-empty">Search for people</li>
            ) : (
              filteredUsers.map((name) => {
                const friend = isFriend(name)
                const initials = name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() || '')
                  .join('')
                return (
                  <li key={name} className="chat-users-row-wrap">
                    <div className="chat-users-row">
                      <span className="chat-users-avatar" aria-hidden>
                        {initials || '?'}
                      </span>
                      <span className="chat-users-name">{name}</span>
                      <div className="chat-users-actions">
                        <button
                          type="button"
                          className={`chat-users-action${friend ? ' is-on' : ''}`}
                          aria-label={
                            friend ? `Remove ${name} from friends` : `Add ${name} as friend`
                          }
                          aria-pressed={friend}
                          onClick={() => toggleFriend(name)}
                        >
                          {friend ? 'Friends' : 'Add'}
                        </button>
                        <button
                          type="button"
                          className="chat-users-action is-message"
                          aria-label={`Message ${name}`}
                          onClick={() => startChatWithUser(name)}
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
          <div className="chat-users-dock">
            <div className="chat-users-bar">
              <span className="chat-users-search-slot" aria-hidden>
                <SearchIcon />
              </span>
              <input
                className="chat-users-search-input"
                type="text"
                inputMode="search"
                name="thrft_users_search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder=""
                aria-label="Search users"
                value={usersQuery}
                onChange={(e) => setUsersQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {memberGlobePhase !== 'closed' && memberGlobeOpen && (
        <BrandGlobe
          variant="dock"
          compact
          phase={
            memberGlobePhase === 'enter'
              ? 'enter'
              : memberGlobePhase === 'exit'
                ? 'exit'
                : 'open'
          }
          brands={memberGlobeItems}
          activeId=""
          title={groupNameStep ? 'Group name' : 'Members'}
          searchValue={groupNameStep ? draftName : memberSearch}
          onSearchChange={groupNameStep ? setDraftName : setMemberSearch}
          searchPlaceholder={groupNameStep ? 'Group name' : 'Search members'}
          onSearchConfirm={
            composer?.mode === 'create' ? onMemberGlobeConfirm : undefined
          }
          searchConfirmDisabled={
            groupNameStep ? false : draftMembers.length === 0
          }
          searchConfirmLabel={
            groupNameStep ? 'Create group chat' : 'Confirm members'
          }
          onSelect={(id) => {
            if (groupNameStep) return
            addMember(id)
          }}
          onClose={closeMemberGlobe}
          onExitComplete={onMemberGlobeExitComplete}
        />
      )}
    </div>
  )
}
