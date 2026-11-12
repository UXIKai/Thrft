import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { fetchSaved, searchAccounts } from '../api.js'
import BrandGlobe from './BrandGlobe.jsx'
import StageSlot from './StageSlot.jsx'
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
            m.kind === 'image' ||
            m.kind === 'file' ||
            m.kind === 'liked' ||
            m.kind === 'friend'
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

function SearchIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15 15l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function PersonIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M5.4 19.4c.6-3.2 3.2-5 6.6-5s6 1.8 6.6 5H5.4z"
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

function ComposeIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V13M18.4 3.6a1.8 1.8 0 0 1 2.5 2.5L12 15l-3.5 1 1-3.5z"
      />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9.2" r="1.4" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 17 4.8-4.6 3.2 3 2.4-2.2 4.6 4.3"
      />
    </svg>
  )
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

function MutedBellIcon() {
  return (
    <svg className="chat-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path d="M18 8a6 6 0 0 0-10-4M6 8v5l-2 4h13M10 21h4M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

function PersonAttachIcon() {
  return (
    <svg className="chat-compose-attach-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4.8 20c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6"
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

function ToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 8h16M4 16h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function ChatScreen({
  onBack,
  onOpenAccount,
  onThreadActiveChange,
} = {}) {
  const [chats, setChats] = useState(() => readStoredChats())
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches,
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(true)
  const [memberDraft, setMemberDraft] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [dmRenaming, setDmRenaming] = useState(false)
  const [dmNameDraft, setDmNameDraft] = useState('')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBarRef = useRef(null)
  useEffect(() => {
    if (!searchOpen) return undefined
    const dismiss = (event) => {
      if (searchBarRef.current?.contains(event.target)) return
      if (event.target.closest?.('[aria-label="Search conversations"]')) return
      document.getElementById('chat-search-input')?.blur()
      setQuery('')
      setSearchOpen(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    return () => document.removeEventListener('pointerdown', dismiss, true)
  }, [searchOpen])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [friendsTab, setFriendsTab] = useState('all')
  const [friendsQuery, setFriendsQuery] = useState('')
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false)
  const [requestsView, setRequestsView] = useState(false)
  const [activeNowOpen, setActiveNowOpen] = useState(true)
  const [requestsTab, setRequestsTab] = useState('requests')
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
  const [createPick, setCreatePick] = useState(null)
  const newChatOpen = composer?.mode === 'create'
  useEffect(() => {
    const stage = document.querySelector('.stage')
    if (!stage) return undefined
    stage.classList.toggle('is-chat-new-open', newChatOpen)
    return () => stage.classList.remove('is-chat-new-open')
  }, [newChatOpen])
  useEffect(() => { if (composer?.mode !== 'create') setCreatePick(null) }, [composer?.mode])
  const [createTab, setCreateTab] = useState('people') // people | group
  const [createQuery, setCreateQuery] = useState('')
  const memberGlobeVisible =
    memberGlobeOpen && memberGlobePhase !== 'closed'

  useEffect(() => {
    const media = window.matchMedia('(min-width: 720px)')
    const updateDesktop = () => setIsDesktop(media.matches)
    updateDesktop()
    media.addEventListener('change', updateDesktop)
    return () => media.removeEventListener('change', updateDesktop)
  }, [])

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
  const [friendListOpen, setFriendListOpen] = useState(false)
  const [likedItems, setLikedItems] = useState([])
  const [likedQuery, setLikedQuery] = useState('')
  const [likedSelected, setLikedSelected] = useState([]) // item keys, max 10
  const [pinsMenuOpen, setPinsMenuOpen] = useState(false)
  const [imagesOnly, setImagesOnly] = useState(false)
  useEffect(() => {
    if (activeChatId) setImagesOnly(false)
  }, [activeChatId])
  useEffect(() => {
    if (activeChatId) setComposer((c) => (c?.mode === 'create' ? null : c))
  }, [activeChatId])
  const [pinsMode, setPinsMode] = useState(null) // null | 'select' | 'pins'
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
  const [pendingImage, setPendingImage] = useState(null)
  useEffect(() => setPendingImage(null), [activeChatId])
  const fileInputRef = useRef(null)
  const attachWrapRef = useRef(null)
  useEffect(() => {
    if (!attachOpen) setFriendListOpen(false)
  }, [attachOpen])
  const activeChat = chats.find((c) => c.id === activeChatId) || null
  useEffect(() => { if (activeChatId) setRequestsView(false) }, [activeChatId])
  const allChatImages = chats.flatMap((c) =>
    (c.messages || [])
      .filter((m) => m.kind === 'image' && m.imageUrl)
      .map((m) => ({ ...m, chatId: c.id })),
  )
  const threadMessages = activeChat?.messages || []
  const managedMembers = useMemo(() => {
    if (!activeChat || activeChat.kind !== 'group') return []
    return (activeChat.members || []).filter((m) => m && m !== 'You')
  }, [activeChat])


  const [accountSearch, setAccountSearch] = useState({ query: '', names: [], error: '', loading: false })
  const createSearching = composer?.mode === 'create' && !(createTab === 'group' && groupNameStep)
  const accountQuery = (
    usersPickerOpen
      ? usersQuery
      : memberGlobeVisible && !groupNameStep
        ? memberSearch
        : createSearching
          ? createQuery
          : ''
  ).trim()
  const allMemberNames = accountSearch.query === accountQuery ? accountSearch.names : []
  const accountSearchError = accountSearch.query === accountQuery ? accountSearch.error : ''

  useEffect(() => {
    let active = true
    if (!accountQuery) {
      setAccountSearch({ query: '', names: [], error: '', loading: false })
      return undefined
    }
    setAccountSearch({ query: accountQuery, names: [], error: '', loading: true })
    const timer = setTimeout(() => {
      searchAccounts(accountQuery).then((accounts) => {
        if (active) setAccountSearch({ query: accountQuery, names: accounts.map((account) => account.username), error: '', loading: false })
      }).catch((error) => {
        if (active) setAccountSearch({ query: accountQuery, names: [], error: error.message || 'Unable to search accounts.', loading: false })
      })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [accountQuery])

  const memberGlobeItems = useMemo(() => {
    const selected = new Set(draftMembers.map((m) => m.toLowerCase()))
    const list = allMemberNames.filter((n) => !selected.has(n.toLowerCase()))
    return list.slice(0, 36).map((name) => ({ id: name, label: name }))
  }, [allMemberNames, draftMembers, memberSearch, groupNameStep])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (c) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.preview.toLowerCase().includes(q)
    return {
      all: chats.filter(match).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))),
    }
  }, [chats, query])

  const filteredLikedItems = useMemo(() => {
    const q = likedQuery.trim().toLowerCase()
    if (!q) return likedItems
    return likedItems.filter((item) => {
      const hay =
        `${item.title || ''} ${item.brandName || ''} ${item.code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [likedItems, likedQuery])

  const filteredUsers = allMemberNames

  const friendsView = useMemo(() => {
    const q = friendsQuery.trim().toLowerCase()
    const match = (name) => !q || name.toLowerCase().includes(q)
    const friendKeys = new Set(friends.map((f) => f.toLowerCase()))
    const names = {
      online: [],
      all: friends,
      pending: [],
      suggestions: allMemberNames.filter((n) => !friendKeys.has(String(n).toLowerCase())),
    }[friendsTab] || []
    const titles = { online: 'Online', all: 'All friends', pending: 'Pending', suggestions: 'Friend Suggestions' }
    const empty = {
      online: 'No friends online right now.',
      all: 'No friends yet.',
      pending: 'No pending requests.',
      suggestions: 'No suggestions right now.',
    }
    const list = names.filter(match)
    return { list, title: titles[friendsTab], empty: empty[friendsTab] }
  }, [friends, friendsTab, friendsQuery, allMemberNames])

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
      setMenuPos((prev) => prev?.context ? prev : {
        top: Math.min(r.bottom + 4, window.innerHeight - 220),
        right: Math.max(8, window.innerWidth - r.right),
        centerX: r.left + r.width / 2,
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
    setSearchOpen(false)
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
    setCreateTab('people')
    setCreateQuery('')
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
          memberUsernames: {
            ...c.memberUsernames,
            [clean]: c.memberUsernames?.[oldName] || usernameForName(oldName),
          },
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
    setCreateQuery('')
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

  function toggleDraftMember(name) {
    const key = name.toLowerCase()
    setDraftMembers((prev) =>
      prev.some((m) => m.toLowerCase() === key)
        ? prev.filter((m) => m.toLowerCase() !== key)
        : [...prev, name],
    )
  }

  function switchCreateTab(tab) {
    setCreateTab(tab)
    setCreateQuery('')
    setCreatePick(null)
    setGroupNameStep(false)
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
          memberUsernames: Object.fromEntries(draftMembers.map((member) => [member, usernameForName(member)])),
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
    if (!activeChatId) return
    if (pendingImage) {
      sendImageFile(pendingImage.file, pendingImage.url)
      setPendingImage(null)
    }
    if (!text) return
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

  function clearPendingImage() {
    setPendingImage(null)
  }

  function sendImageFile(file, existingUrl) {
    if (!file || !activeChatId) return
    const url = existingUrl || URL.createObjectURL(file)
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

  function sendFriendInvite(chat) {
    if (!activeChatId || !chat) return
    const name = chat.title || 'Friend'
    pushThreadMessage(
      {
        id: `m-${Date.now()}`,
        kind: 'friend',
        text: name,
        from: 'me',
        at: Date.now(),
      },
      `Invite · ${name}`,
    )
    setFriendListOpen(false)
    setAttachOpen(false)
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

  function backToChats() {
    if (isDesktop || !activeChat) onBack?.()
    setActiveChatId(null)
    setDraftMessage('')
    setAttachOpen(false)
    setLikedPickerOpen(false)
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    setPeerProfile(null)
  }

  function closeMenus() {
    setMenuId(null)
    setMenuPos(null)
    setDmRenaming(false)
  }

  function saveDmName(id) {
    const name = dmNameDraft.trim()
    if (name) {
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: name } : c)))
    }
    closeMenus()
  }

  function closePinsMenu() {
    setPinsMenuOpen(false)
  }

  function setPinsEditMode(mode) {
    setPinsMode((prev) => (prev === mode ? null : mode))
    setPinsMenuOpen(false)
    setPinSelectedIds([])
  }

  function toggleChatSelection(id) {
    setPinSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id],
    )
  }

  function deleteSelectedChats() {
    if (pinSelectedIds.includes(activeChatId)) {
      deleteChat(activeChatId)
    }
    setChats((prev) => prev.filter((chat) => !pinSelectedIds.includes(chat.id)))
    setPinSelectedIds([])
    setPinsMode(null)
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

  function openPeerProfile(name) {
    const clean = String(name || '').trim()
    if (!clean || clean === 'You') return
    if (activeChat?.kind === 'group') {
      setMembersSheetOpen(false)
      setContactSheetOpen(false)
      setPeerProfile(null)
      onOpenAccount?.(activeChat.memberUsernames?.[clean] || usernameForName(clean))
      return
    }
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

  const longPressRef = useRef({ timer: 0, x: 0, y: 0 })
  const longPressFiredRef = useRef(false)

  useEffect(() => () => window.clearTimeout(longPressRef.current.timer), [])

  function cancelRowPress() {
    window.clearTimeout(longPressRef.current.timer)
  }

  function moveRowPress(e) {
    const p = longPressRef.current
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelRowPress()
  }

  function startRowPress(e, chatId) {
    if (e.button !== 0) return
    cancelRowPress()
    longPressFiredRef.current = false
    longPressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        longPressFiredRef.current = true
        setMenuPos({
          top: window.innerHeight / 2,
          right: 0,
          centerX: window.innerWidth / 2,
          centered: true,
          context: true,
        })
        setMenuId(chatId)
      }, 450),
    }
  }

  function openRowMenu(chat) {
    if (chat.kind !== 'dm') {
      openMenu(chat.id)
      return
    }
    if (menuId === chat.id) {
      closeMenus()
      return
    }
    setMenuPos({
      top: window.innerHeight / 2,
      right: 0,
      centerX: window.innerWidth / 2,
      centered: true,
      context: true,
    })
    setMenuId(chat.id)
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
    setChats((prev) => prev.map((row) => row.id === chat.id ? { ...row, unread: false } : row))
    setActiveChatId(chat.id)
    if (isDesktop) setSidebarCollapsed(true)
    setDraftMessage('')
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    setNickDraft(chat.title)
    closeMenus()
  }

  function toggleChatFlag(id, flag) {
    setChats((prev) => prev.map((chat) =>
      chat.id === id ? { ...chat, [flag]: !chat[flag] } : chat,
    ))
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
    setPeerProfile(null)
    closeMenus()
  }

  function blockChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id))
    setActiveChatId(null)
    setContactSheetOpen(false)
    setMembersSheetOpen(false)
    setEditingNick(false)
    setPeerProfile(null)
    closeMenus()
  }

  useEffect(() => {
    if ((!contactSheetOpen && !peerProfile) || !editingNick) return undefined
    const id = requestAnimationFrame(() => {
      nickInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [contactSheetOpen, peerProfile, editingNick])

  function renderDmMenu() {
    if (!menuId || !menuPos) return null
    if (chats.find((c) => c.id === menuId)?.kind !== 'dm') return null
    return (
        <div
          className="chat-dm-menu-wrap"
          style={
            menuPos.centered
              ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
              : peerProfile || activeChat
              ? { top: menuPos.top, left: menuPos.centerX, transform: 'translateX(-50%)' }
              : { top: menuPos.top, right: menuPos.right }
          }
        >
          {(() => {
            const chat = chats.find((c) => c.id === menuId)
            return (
              <div className="chat-dm-menu" role="menu" aria-label={`Options for ${chat.title}`}>
                {dmRenaming ? (
                  <>
                    <input
                      className="chat-dm-menu-input"
                      type="text"
                      value={dmNameDraft}
                      maxLength={32}
                      autoFocus
                      aria-label="Name"
                      onChange={(e) => setDmNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDmName(chat.id)
                      }}
                    />
                    <button
                      type="button"
                      className="chat-dm-menu-btn"
                      aria-label="Save name"
                      onClick={() => saveDmName(chat.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="chat-dm-menu-btn"
                      aria-label="Edit name"
                      onClick={() => {
                        closeMenus()
                        // Hidden input opens the iOS keyboard inside the tap; the real field takes focus synchronously
                        const kb = document.createElement('input')
                        kb.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;font-size:16px'
                        document.body.appendChild(kb)
                        kb.focus({ preventScroll: true })
                        flushSync(() => {
                          if (peerProfile) {
                            setNickDraft(peerProfile.name)
                          } else {
                            setNickDraft(chat.title || '')
                            setContactSheetOpen(true)
                          }
                          setEditingNick(true)
                        })
                        const real = nickInputRef.current
                        if (real) real.focus({ preventScroll: true })
                        setTimeout(() => kb.remove(), real ? 50 : 800)
                      }}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="chat-dm-menu-btn"
                      aria-label="Remove"
                      onClick={() => deleteChat(chat.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M7.5 12h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="chat-dm-menu-btn is-danger"
                      aria-label="Block"
                      onClick={() => blockChat(chat.id)}
                    >
                      <BlockIcon className="chat-dm-menu-ico" />
                    </button>
                  </>
                )}
              </div>
            )
          })()}
        </div>
    )
  }

  function renderThread() {
    if (!activeChat) return null
    return (
      <div
        className="chat-thread"
        role="dialog"
        aria-label={activeChat.title}
      >
        {menuId &&
          createPortal(
            <div className="chat-dm-portal">
              <button
                type="button"
                className="chat-dm-portal-scrim"
                aria-label="Dismiss menu"
                onClick={closeMenus}
              />
              {renderDmMenu()}
            </div>,
            document.body,
          )}
        <header className="chat-thread-top">
          {isDesktop ? (
            <span className="chat-top-btn" aria-hidden />
          ) : (
            <button
              type="button"
              className="chat-top-btn"
              aria-label="Back to chats"
              onClick={backToChats}
            >
              <BackIcon />
            </button>
          )}
          <span className="chat-thread-heading" aria-hidden />
          <span className="chat-top-btn" aria-hidden />
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
                  {msg.kind === 'friend' ? (
                    <div className="chat-thread-bubble-liked">
                      <PersonAttachIcon />
                      <span>{msg.text}</span>
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
                  <button
                    type="button"
                    className="chat-compose-attach-btn"
                    aria-label="Send a friend"
                    aria-expanded={friendListOpen}
                    onClick={() => setFriendListOpen((v) => !v)}
                  >
                    <PersonAttachIcon />
                  </button>
                  {friendListOpen ? (
                    <ul className="chat-friend-list" aria-label="Friends">
                      {chats
                        .filter((c) => c.id !== activeChatId && c.title)
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="chat-friend-item"
                              onClick={() => sendFriendInvite(c)}
                            >
                              {c.title}
                            </button>
                          </li>
                        ))}
                    </ul>
                  ) : null}
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
                if (file) {
                  setPendingImage({ file, url: URL.createObjectURL(file) })
                  setAttachOpen(false)
                  composeInputRef.current?.focus({ preventScroll: true })
                }
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
            {pendingImage && (
              <span className="chat-compose-preview">
                <img src={pendingImage.url} alt="Photo to send" />
                <button
                  type="button"
                  className="chat-compose-preview-x is-bare"
                  aria-label="Remove photo"
                  onClick={clearPendingImage}
                >
                  <CloseIcon />
                </button>
              </span>
            )}
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
              disabled={!draftMessage.trim() && !pendingImage}
            >
              <SendIcon />
            </button>
          </div>
        </form>

        {likedPickerOpen ? (
          <StageSlot>
          <div
            className="chat-liked-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Send liked items"
          >
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
                <button
                  type="button"
                  className="chat-liked-back"
                  aria-label="Back"
                  onClick={closeLikedPicker}
                >
                  <BackIcon />
                </button>
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
          </StageSlot>
        ) : null}

        {contactSheetOpen && !peerProfile && (
          <StageSlot>
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
                aria-label="Back"
                onClick={closeContactSheet}
              >
                <BackIcon />
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
                      size={Math.max(2, nickDraft.length + 1)}
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      aria-label="Name"
                    />
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
              <div className="chat-contact-photos">
                {threadMessages
                  .filter((m) => m.kind === 'image' && m.imageUrl)
                  .map((m) => (
                    <img
                      key={m.id}
                      className="chat-contact-photo"
                      src={m.imageUrl}
                      alt={m.fileName || 'Photo'}
                      loading="lazy"
                    />
                  ))}
              </div>
            </div>
          </div>
          </StageSlot>
        )}

        {membersSheetOpen && activeChat?.kind === 'group' && (
          <StageSlot>
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
                aria-label="Back"
                onClick={closeMembersSheet}
              >
                <BackIcon />
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
                              className="chat-member-action is-bare"
                              aria-label={`Message ${member}`}
                              title="Chat"
                              onClick={() => messageGroupMember(member)}
                            >
                              <ChatBubbleIcon />
                            </button>
                            <button
                              type="button"
                              className="chat-member-action is-bare"
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
                              className="chat-member-action is-bare is-danger"
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
          </StageSlot>
        )}

        {peerProfile && (
          <StageSlot>
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
                aria-label="Back"
                onClick={closePeerProfile}
              >
                <BackIcon />
              </button>
              {!peerProfile.fromGroup ? (
                <button
                  type="button"
                  className="chat-contact-dots is-bare"
                  aria-label="More"
                  ref={(el) => {
                    if (el) dotsRefs.current.set(activeChat.id, el)
                    else dotsRefs.current.delete(activeChat.id)
                  }}
                  onClick={() => openMenu(activeChat.id)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    aria-hidden
                    style={{
                      transform: menuId ? 'rotate(45deg)' : 'none',
                      transition: 'transform 0.25s ease',
                    }}
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      d="M12 5v14M5 12h14"
                    />
                  </svg>
                </button>
              ) : null}
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
                      size={Math.max(2, nickDraft.length + 1)}
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      aria-label="Name"
                    />
                  </form>
                ) : (
                  <>
                    <span className="chat-contact-name-spacer" aria-hidden />
                    <p className="chat-contact-name">{peerProfile.name}</p>
                    {peerProfile.fromGroup ? (
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
                    ) : (
                      <span className="chat-contact-name-spacer" aria-hidden />
                    )}
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
              <div className="chat-contact-photos">
                {threadMessages
                  .filter((m) => m.kind === 'image' && m.imageUrl)
                  .map((m) => (
                    <img
                      key={m.id}
                      className="chat-contact-photo"
                      src={m.imageUrl}
                      alt={m.fileName || 'Photo'}
                      loading="lazy"
                    />
                  ))}
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
          </StageSlot>
        )}
      </div>
    )
  }

  const newChatPanel = composer?.mode === 'create' ? (
    <div className="chat-new-card">
              {!groupNameStep && (
                <div className="chat-new-top">
                  <button type="button" className="chat-new-back is-bare" aria-label="Back to chats" onClick={closeComposer}>
                    <BackIcon />
                  </button>
                  {createQuery.trim() && (createTab === 'group' ? draftMembers.length > 0 : createPick) && (
                    <button
                      type="button"
                      className="chat-new-back is-bare"
                      aria-label={createTab === 'group' ? `Done, ${draftMembers.length} selected` : `Message ${createPick}`}
                      onClick={() => {
                        if (createTab === 'group') { setGroupNameStep(true); setDraftName(''); setCreateQuery('') }
                        else startChatWithUser(createPick)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                </div>
              )}
              <div className="chat-new-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'people'}
                  aria-label="Find friends and new people"
                  className={`chat-new-tab is-bare${createTab === 'people' ? ' is-on' : ''}`}
                  onClick={() => switchCreateTab('people')}
                >
                  <PersonIcon />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={createTab === 'group'}
                  aria-label="Create group chat"
                  className={`chat-new-tab is-bare${createTab === 'group' ? ' is-on' : ''}`}
                  onClick={() => switchCreateTab('group')}
                >
                  <PeopleIcon />
                </button>
              </div>

              <div className="chat-new-panel">
                {createTab === 'group' && groupNameStep ? (
                  <>
                    <p className="chat-new-label">
                      Name your group · {draftMembers.length} {draftMembers.length === 1 ? 'member' : 'members'}
                    </p>
                    <div className="chat-new-field">
                      <input
                        className="chat-new-input"
                        type="text"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Group name"
                        aria-label="Group name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') onMemberGlobeConfirm() }}
                      />
                    </div>
                    <div className="chat-new-foot">
                      <button type="button" className="chat-new-foot-btn" aria-label="Back to members" onClick={() => setGroupNameStep(false)}>
                        <BackIcon />
                      </button>
                      <button type="button" className="chat-new-foot-btn is-primary" aria-label="Create group chat" onClick={onMemberGlobeConfirm}>
                        <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span>Create</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="chat-new-field">
                      <input
                        className="chat-new-input"
                        type="text"
                        inputMode="search"
                        name={createTab === 'group' ? 'thrft_group_members_search' : 'thrft_users_search'}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder={createTab === 'group' ? 'Group' : 'Friends'}
                        aria-label={createTab === 'group' ? 'Search members' : 'Search users'}
                        value={createQuery}
                        onChange={(e) => setCreateQuery(e.target.value)}
                      />
                    </div>
                    <ul className="chat-new-list">
                      {createTab === 'group' && draftMembers
                        .filter((m) => !allMemberNames.some((n) => n.toLowerCase() === m.toLowerCase()))
                        .map((name) => (
                          <li key={`sel-${name}`}>
                            <label className="chat-new-row">
                              <span className="chat-users-avatar" aria-hidden>{(name[0] || '?').toUpperCase()}</span>
                              <span className="chat-users-name">{name}</span>
                              <input type="checkbox" className="chat-new-check" checked onChange={() => toggleDraftMember(name)} aria-label={`Remove ${name}`} />
                            </label>
                          </li>
                        ))}
                      {accountSearchError && <li role="alert" className="chat-new-note">{accountSearchError}</li>}
                      {accountQuery && !accountSearchError && (
                        accountSearch.loading || accountSearch.query !== accountQuery
                          ? <li role="status" className="chat-new-note">Searching accounts...</li>
                          : filteredUsers.length === 0 && <li role="status" className="chat-new-note">No accounts found.</li>
                      )}
                      {filteredUsers.map((name) => {
                        const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('')
                        if (createTab === 'group') {
                          const checked = draftMembers.some((m) => m.toLowerCase() === name.toLowerCase())
                          return (
                            <li key={name}>
                              <label className="chat-new-row">
                                <span className="chat-users-avatar" aria-hidden>{initials || '?'}</span>
                                <span className="chat-users-name">{name}</span>
                                <input type="checkbox" className="chat-new-check" checked={checked} onChange={() => toggleDraftMember(name)} aria-label={`Select ${name}`} />
                              </label>
                            </li>
                          )
                        }
                        const friend = isFriend(name)
                        return (
                          <li key={name}>
                            <div className="chat-new-row">
                              <span className="chat-users-avatar" aria-hidden>{initials || '?'}</span>
                              <span className="chat-users-name">{name}</span>
                              <div className="chat-users-actions">
                                <button
                                  type="button"
                                  className={`chat-users-action${friend ? ' is-on' : ''}`}
                                  aria-label={friend ? `Remove ${name} from friends` : `Add ${name} as friend`}
                                  aria-pressed={friend}
                                  onClick={() => toggleFriend(name)}
                                >
                                  {friend ? <CheckCircleIcon className="chat-ico" /> : <PlusIcon />}
                                </button>
                                <input type="checkbox" className="chat-new-check" checked={createPick === name} onChange={() => setCreatePick((c) => (c === name ? null : name))} aria-label={`Select ${name}`} />
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>
            </div>
  ) : null

  if (activeChat && !isDesktop) return renderThread()

  return (
    <div
      className={`chat-screen${composer?.mode === 'create' ? ' is-new-chat' : ''}${isDesktop ? ' is-desktop' : ''}${isDesktop && sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${!isDesktop && mobileNavOpen ? ' is-mobile-nav-open' : ''}`}
      onClick={(e) => {
        const onContent = e.target.closest?.('button,a,input,textarea,select,label,img,li,svg,.chat-new-card,.chat-thread,.chat-friends-tab-group,.chat-sidebar-header,.chat-images-grid,.chat-images-title,.chat-desktop-empty')
        if (isDesktop && !onContent) {
          if (activeChat && !sidebarCollapsed && !e.target.closest(".chat-desktop-thread")) setActiveChatId(null)
          if (imagesOnly) setImagesOnly(false)
          if (composer?.mode === 'create') closeComposer()
        }
      }}
    >
      {menuId && chats.find((c) => c.id === menuId)?.kind !== 'dm' && (
        <button
          type="button"
          className="chat-menu-scrim"
          aria-label="Dismiss menu"
          onClick={closeMenus}
        />
      )}

      <section
        className={`chat-section chat-pins-section${pinsMode ? ` is-mode-${pinsMode}` : ''}`}
        aria-label="Chat controls"
      >
        <div className="chat-sidebar-header">
          <button
            type="button"
            className="chat-sidebar-control is-bare chat-sidebar-back"
            aria-label={isDesktop ? 'Back to Home' : mobileNavOpen ? 'Close chats' : 'Open chats'}
            aria-expanded={isDesktop ? undefined : mobileNavOpen}
            onClick={isDesktop ? backToChats : () => setMobileNavOpen((open) => !open)}
          >
            {isDesktop ? <BackIcon /> : <ToggleIcon />}
          </button>
          <h1 className="chat-sidebar-title">Chats</h1>
          <button
            type="button"
            className="chat-sidebar-control is-bare"
            aria-label="Search conversations"
            aria-expanded={searchOpen}
            onClick={() => {
              flushSync(() => setSearchOpen(true))
              document.getElementById('chat-search-input')?.focus({ preventScroll: true })
            }}
          >
            <SearchIcon />
          </button>
          {isDesktop && (
            <button
              type="button"
              className="chat-sidebar-control is-bare"
              aria-label={sidebarCollapsed ? 'Show chats' : 'Hide chats'}
              aria-expanded={!sidebarCollapsed}
              onClick={() => {
                setSidebarCollapsed((collapsed) => !collapsed)
                setPinsMenuOpen(false)
                setListFilterOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 4v16" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {!isDesktop && mobileNavOpen && (
        <button type="button" className="chat-mobile-nav-scrim" aria-label="Close chats" onClick={() => setMobileNavOpen(false)} />
      )}
      <section
        className="chat-section chat-list-section"
        aria-label="Chats"
        onClick={(e) => {
          if (!isDesktop && e.target.closest('.chat-list-quick-btn, .chat-row')) setMobileNavOpen(false)
        }}
      >
        <nav className="chat-list-quick" aria-label="Quick actions">
          <button type="button" className={`chat-list-quick-btn is-bare${composer?.mode === 'create' ? ' is-on' : ''}`} onClick={() => (composer?.mode === 'create' ? closeComposer() : openCreateGroup())}>
            <ComposeIcon />
            <span>New chat</span>
          </button>
          <button
            type="button"
            className={`chat-list-quick-btn is-bare${imagesOnly ? ' is-on' : ''}`}
            aria-pressed={imagesOnly}
            onClick={() => { if (composer) closeComposer(); setImagesOnly((on) => !on) }}
          >
            <GalleryIcon />
            <span>Images</span>
          </button>
          <button
            type="button"
            className={`chat-list-quick-btn is-bare${!imagesOnly && !requestsView && !activeChat && !composer ? ' is-on' : ''}`}
            onClick={() => { if (composer) closeComposer(); setImagesOnly(false); setRequestsView(false); setActiveChatId(null) }}
          >
            <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden width="20" height="20" fill="currentColor"><circle cx="12" cy="8" r="3.5" /><path d="M5.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6z" /></svg>
            <span>Friends</span>
          </button>
          <button
            type="button"
            className={`chat-list-quick-btn is-bare${requestsView ? ' is-on' : ''}`}
            aria-pressed={requestsView}
            onClick={() => { if (composer) closeComposer(); setImagesOnly(false); setActiveChatId(null); setRequestsView(true) }}
          >
            <svg className="chat-ico" viewBox="0 0 24 24" aria-hidden width="20" height="20"><rect x="3.500" y="5.500" width="17" height="13" rx="2.500" fill="none" stroke="currentColor" strokeWidth="1.600" /><path d="M4 7.500l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Message requests</span>
          </button>
        </nav>
        <ul className="chat-list">
          {filtered.all.map((chat, index) => (
            <Fragment key={chat.id}>
            {chat.pinned && index === 0 && (
              <li className="chat-folder-head">
                <button
                  type="button"
                  className="chat-folder-toggle"
                  aria-expanded={!pinnedCollapsed}
                  onClick={() => setPinnedCollapsed((c) => !c)}
                >
                  <span>Pinned</span>
                  <svg className={`chat-folder-chevron${pinnedCollapsed ? '' : ' is-open'}`} viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            )}
            {!(pinnedCollapsed && chat.pinned) && (
            <li
              className={`chat-row-wrap${menuId === chat.id ? ' is-menu-open' : ''}`}
            >
              <button
                type="button"
                className="chat-row"
                aria-label={pinsMode === 'pins' && chat.pinned ? `Unpin ${chat.title}` : undefined}
                aria-pressed={pinsMode === 'select' ? pinSelectedIds.includes(chat.id) : undefined}
                onClick={() => {
                  if (pinsMode === 'select') {
                    toggleChatSelection(chat.id)
                    return
                  }
                  if (pinsMode === 'pins') {
                    if (chat.pinned) togglePin(chat.id)
                    return
                  }
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false
                    return
                  }
                  openThread(chat)
                }}
                onPointerDown={(e) => {
                  if (!pinsMode) startRowPress(e, chat.id)
                }}
                onPointerMove={moveRowPress}
                onPointerUp={cancelRowPress}
                onPointerCancel={cancelRowPress}
                onPointerLeave={cancelRowPress}
                onContextMenu={(e) => e.preventDefault()}
              >
                {pinsMode === 'select' && (
                  <span
                    className={`chat-select-circle${pinSelectedIds.includes(chat.id) ? ' is-selected' : ''}`}
                    aria-hidden
                  >
                    {pinSelectedIds.includes(chat.id) ? <FilterCheckIcon /> : null}
                  </span>
                )}
                <span className="chat-avatar" aria-hidden>
                  {pinsMode === 'pins' && chat.pinned && (
                    <span className="chat-pin-remove"><MinusIcon /></span>
                  )}
                  {chat.initials}
                </span>
                <span className="chat-row-copy">
                  <span className="chat-row-top">
                    <span className="chat-row-title">
                      {chat.title}
                      {chat.pinned && <span className="chat-row-pin" aria-label="Pinned"><PinIcon /></span>}
                      {chat.unread && <span className="chat-unread-dot" aria-label="Unread" />}
                      {chat.muted && <span aria-label="Alerts hidden"><MutedBellIcon /></span>}
                      {chat.kind === 'group' && (
                        <span className="chat-group-tag">Group</span>
                      )}
                    </span>
                    <span className="chat-row-time">{chat.time}</span>
                  </span>
                  <span className="chat-row-preview">{chat.preview}</span>
                </span>
              </button>
              {!pinsMode && (
                <span className="chat-row-actions">
                  <button
                    type="button"
                    className="chat-row-action is-bare"
                    aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`}
                    onClick={() => togglePin(chat.id)}
                  >
                    <PinIcon className="chat-row-action-ico" />
                  </button>
                  <button
                    type="button"
                    className="chat-row-action is-bare"
                    aria-label={`More for ${chat.title}`}
                    ref={(el) => {
                      if (el) dotsRefs.current.set(chat.id, el)
                      else dotsRefs.current.delete(chat.id)
                    }}
                    onClick={() => openRowMenu(chat)}
                  >
                    <DotsIcon />
                  </button>
                </span>
              )}
            </li>
            )}
            </Fragment>
          ))}
          {filtered.all.length === 0 && (
            <li className="chat-empty-list" aria-hidden />
          )}
        </ul>
      </section>

      {isDesktop ? (
        <section
          className="chat-desktop-thread"
          aria-label="Conversation"
          onClick={(e) => {
            const blank = e.target === e.currentTarget || e.target.classList.contains('chat-new-screen') || e.target.classList.contains('chat-images-gallery')
            if (!blank) return
            if (imagesOnly) setImagesOnly(false)
            if (composer?.mode === 'create') closeComposer()
          }}
        >
          {newChatPanel ? (
            <div className="chat-new-screen">{newChatPanel}</div>
          ) : imagesOnly ? (
            <div className="chat-images-gallery">
              <h2 className="chat-images-title">Images</h2>
              {allChatImages.length ? (
                <div className="chat-images-grid">
                  {allChatImages.map((m) => (
                    <img
                      key={`${m.chatId}-${m.id}`}
                      className="chat-images-item"
                      src={m.imageUrl}
                      alt={m.fileName || 'Photo'}
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : (
                <p className="chat-desktop-empty">No images yet</p>
              )}
            </div>
          ) : requestsView && !activeChat ? (
            <div className="chat-friends-empty">
              <nav className="chat-friends-tabs" aria-label="Message requests">
                <span className="chat-friends-label">Message Requests</span>
                <div className="chat-friends-tab-group is-two" style={{ '--tab-index': requestsTab === 'spam' ? 1 : 0 }}>
                  <span className="chat-friends-pill" aria-hidden />
                  {[['requests', 'Requests'], ['spam', 'Spam']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`chat-friends-tab${requestsTab === id ? ' is-active' : ''}`}
                      aria-pressed={requestsTab === id}
                      onClick={() => setRequestsTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="chat-friends-body">
                <div className="chat-friends-panel">
                  <p className="chat-desktop-empty">{requestsTab === 'spam' ? 'No spam messages' : 'No message requests'}</p>
                </div>
              </div>
            </div>
          ) : activeChat ? (
            renderThread()
          ) : (
            <div className="chat-friends-empty">
              <nav className="chat-friends-tabs" aria-label="Friends">
                <span className="chat-friends-label">
                  <svg viewBox="-3 0 24 24" aria-hidden width="20" height="20" fill="currentColor"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.500-6s6.500 2.400 6.500 6z" /></svg>
                  {friends.length}
                </span>
                <div
                  className="chat-friends-tab-group"
                  style={{ '--tab-index': ['online', 'all', 'pending', 'suggestions'].indexOf(friendsTab), touchAction: 'pan-y' }}
                  onPointerDown={(e) => {
                    const el = e.currentTarget
                    el.dataset.drag = '1'
                    el.setPointerCapture?.(e.pointerId)
                    const r = el.getBoundingClientRect()
                    const i = Math.max(0, Math.min(3, Math.floor(((e.clientX - r.left) / r.width) * 4)))
                    setFriendsTab(['online', 'all', 'pending', 'suggestions'][i])
                  }}
                  onPointerMove={(e) => {
                    const el = e.currentTarget
                    if (el.dataset.drag !== '1') return
                    const r = el.getBoundingClientRect()
                    const i = Math.max(0, Math.min(3, Math.floor(((e.clientX - r.left) / r.width) * 4)))
                    const id = ['online', 'all', 'pending', 'suggestions'][i]
                    if (id !== friendsTab) setFriendsTab(id)
                  }}
                  onPointerUp={(e) => { e.currentTarget.dataset.drag = '0' }}
                  onPointerCancel={(e) => { e.currentTarget.dataset.drag = '0' }}
                >
                  <span className="chat-friends-pill" aria-hidden />
                {[['online', 'Online'], ['all', 'All'], ['pending', 'Pending'], ['suggestions', 'Suggestions']].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`chat-friends-tab${friendsTab === id ? ' is-active' : ''}`}
                    aria-pressed={friendsTab === id}
                    onClick={() => setFriendsTab(id)}
                  >
                    {label}
                  </button>
                ))}
                </div>
                <div className={`chat-friends-active-head${activeNowOpen ? '' : ' is-collapsed'}`}>
                  {activeNowOpen && <h3 className="chat-friends-active-title">Active Now</h3>}
                  <button
                    type="button"
                    className="chat-friends-active-toggle"
                    aria-label={activeNowOpen ? 'Close Active Now' : 'Open Active Now'}
                    aria-expanded={activeNowOpen}
                    onClick={() => setActiveNowOpen((o) => !o)}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden style={{ transform: activeNowOpen ? 'none' : 'scaleX(-1)' }}>
                      <path d="M4 12h11M11 8l4 4-4 4M20 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </nav>
              <div className="chat-friends-body">
              <div className="chat-friends-panel">
                <input
                  type="search"
                  className="chat-friends-search"
                  placeholder="Search"
                  aria-label="Search friends"
                  value={friendsQuery}
                  onChange={(e) => setFriendsQuery(e.target.value)}
                />
                <p className="chat-friends-heading">{friendsView.title} — {friendsView.list.length}</p>
                {friendsView.list.length === 0 ? (
                  <p className="chat-desktop-empty">{friendsView.empty}</p>
                ) : (
                  <ul className="chat-friends-list">
                    {friendsView.list.map((name) => {
                      const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('')
                      const friend = isFriend(name)
                      return (
                        <li key={name} className="chat-friends-row">
                          <span className="chat-users-avatar" aria-hidden>{initials || '?'}</span>
                          <span className="chat-users-name">{name}</span>
                          <div className="chat-users-actions">
                            <button type="button" className="chat-users-action" aria-label={`Message ${name}`} onClick={() => startChatWithUser(name)}>
                              <SendIcon />
                            </button>
                            <button
                              type="button"
                              className={`chat-users-action${friend ? ' is-on' : ''}`}
                              aria-label={friend ? `Remove ${name} from friends` : `Add ${name} as friend`}
                              aria-pressed={friend}
                              onClick={() => toggleFriend(name)}
                            >
                              {friend ? <CheckCircleIcon className="chat-ico" /> : <PlusIcon />}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <aside className={`chat-friends-active${activeNowOpen ? '' : ' is-collapsed'}`} aria-label="Active Now" hidden={!activeNowOpen}>
                {activeNowOpen && <p className="chat-friends-active-empty">It's quiet for now…</p>}
              </aside>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {!composer && searchOpen && isDesktop && (
        <div className="chat-search-modal-overlay">
          <div ref={searchBarRef} className="chat-search-modal" role="dialog" aria-label="Search chats">
            <div className="chat-search-modal-head">
              <input
                id="chat-search-input"
                className="chat-search-modal-input"
                type="text"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="Search..."
                aria-label="Search chats"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) } }}
              />
              <button type="button" className="chat-search-modal-close" aria-label="Close search" onClick={() => { setQuery(''); setSearchOpen(false) }}>
                <CloseIcon />
              </button>
            </div>
            <p className="chat-search-modal-label">{query.trim() ? 'Results' : 'Recent chats'}</p>
            <ul className="chat-search-modal-list">
              {filtered.all.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    className="chat-search-modal-row"
                    onClick={() => { setQuery(''); setSearchOpen(false); openThread(chat) }}
                  >
                    <span className="chat-avatar" aria-hidden>{chat.initials}</span>
                    <span className="chat-search-modal-title">{chat.title}</span>
                  </button>
                </li>
              ))}
              {filtered.all.length === 0 && <li className="chat-search-modal-empty">No chats found</li>}
            </ul>
          </div>
        </div>
      )}

      {!composer && searchOpen && !isDesktop && <StageSlot active={!isDesktop}>
          <div className={`chat-bottom-dock${isDesktop ? ' is-desktop' : ''}${usersPickerOpen || memberGlobeVisible ? ' is-covered' : ''}`}>
            <div
              ref={searchBarRef}
              className={`chat-search-bar${searchOpen ? '' : ' is-collapsed'}`}
              onClick={(event) => {
                if (event.target.closest('button')) return
                document.getElementById('chat-search-input')?.focus({ preventScroll: true })
              }}
            >
              {searchOpen ? (
                <button
                  type="button"
                  className="chat-dock-search chat-dock-new"
                  aria-label="Close search"
                  onClick={() => {
                    setQuery('')
                    setSearchOpen(false)
                  }}
                >
                  <SearchIcon />
                </button>
              ) : null}
              {searchOpen ? (
                <input
                  id="chat-search-input"
                  className="chat-search-input"
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              ) : null}
              <button
                type="button"
                className="chat-search-add"
                aria-label="New chat"
                onClick={onDockPlusClick}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
      </StageSlot>}

      {menuId &&
        menuPos &&
        !menuPos.context &&
        chats.find((c) => c.id === menuId)?.kind === 'dm' &&
        createPortal(
          <div className="chat-dm-portal">
            <button
              type="button"
              className="chat-dm-portal-scrim"
              aria-label="Dismiss menu"
              onClick={closeMenus}
            />
            {renderDmMenu()}
          </div>,
          document.body,
        )}

      {menuId && menuPos?.context && createPortal(
        <div className="chat-dm-portal chat-hold-portal">
          <button type="button" className="chat-dm-portal-scrim" aria-label="Dismiss chat actions" onClick={closeMenus} />
          <div className="chat-hold-stack">
            {(() => {
              const chat = chats.find((row) => row.id === menuId)
              if (!chat) return null
              return (
                <section className="chat-hold-preview" aria-label={`Preview of ${chat.title}`}>
                  <header className="chat-hold-preview-heading">{chat.title}</header>
                  <div
                    className="chat-hold-preview-messages"
                    ref={(el) => {
                      if (el) el.scrollTop = el.scrollHeight
                    }}
                  >
                    {chat.messages.length ? chat.messages.slice(-12).map((msg) => (
                      <div key={msg.id} className={`chat-thread-bubble ${msg.from === 'me' ? 'is-me' : 'is-them'}`}>
                        {msg.kind === 'image' && msg.imageUrl ? (
                          <img className="chat-thread-bubble-image" src={msg.imageUrl} alt={msg.fileName || 'Photo'} />
                        ) : (
                          <p className="chat-thread-bubble-text">
                            {msg.kind === 'file' ? msg.fileName || msg.text : msg.text}
                          </p>
                        )}
                        {msg.at ? <span className="chat-thread-bubble-time">{formatMsgTime(msg.at)}</span> : null}
                      </div>
                    )) : (
                      <p className="chat-thread-empty">Message {chat.title}</p>
                    )}
                  </div>
                </section>
              )
            })()}
          <div className="chat-hold-menu" role="menu" aria-label="Chat actions">
            {(() => {
              const chat = chats.find((row) => row.id === menuId)
              if (!chat) return null
              return (
                <>
                  <button type="button" role="menuitem" className="chat-hold-action is-bare" onClick={() => togglePin(chat.id)}>
                    <PinIcon /><span>{chat.pinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-hold-action is-bare" onClick={() => toggleChatFlag(chat.id, 'unread')}>
                    <ChatBubbleIcon className="chat-menu-ico" /><span>{chat.unread ? 'Mark as Read' : 'Mark as Unread'}</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-hold-action is-bare" onClick={() => toggleChatFlag(chat.id, 'muted')}>
                    <MutedBellIcon /><span>{chat.muted ? 'Show Alerts' : 'Hide Alerts'}</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-hold-action is-bare is-danger" onClick={() => deleteChat(chat.id)}>
                    <TrashIcon className="chat-menu-ico" /><span>Delete</span>
                  </button>
                </>
              )
            })()}
          </div>
          </div>
        </div>,
        document.body,
      )}

      {menuId && menuPos && !menuPos.context && chats.find((c) => c.id === menuId)?.kind !== 'dm' && (
        <div
          ref={menuRef}
          className="chat-menu is-fixed"
          role="menu"
          style={
            menuPos.centered
              ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
              : { top: menuPos.top, right: menuPos.right }
          }
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

      {composer && composer.mode !== 'create' && !usersPickerOpen && (
        <StageSlot>
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
                  <PersonIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="chat-sheet-save" onClick={saveComposer}>
                Save changes
              </button>
            )}
            {composer.mode === 'create' && (
              <button
                type="button"
                className="chat-sheet-x"
                aria-label="Close"
                onClick={closeComposer}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        </StageSlot>
      )}

      {!isDesktop && newChatPanel && (
        <StageSlot>
          <div
            className="chat-new-screen is-overlay"
            role="dialog"
            aria-label="New chat"
            onClick={(e) => { if (e.target === e.currentTarget) closeComposer() }}
          >
            {newChatPanel}
          </div>
        </StageSlot>
      )}

      {usersPickerOpen ? (
        <StageSlot>
        <div
          className="chat-users-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Find friends and chats"
        >
          <button
            type="button"
            className="chat-users-scrim"
            aria-label="Dismiss"
            onClick={closeUsersPicker}
          />
          <div className="chat-users-hero" aria-hidden>
            <PersonIcon />
          </div>
          <ul className="chat-users-list">
            {accountSearchError && <li role="alert">{accountSearchError}</li>}
            {accountQuery && !accountSearchError && (
              accountSearch.loading || accountSearch.query !== accountQuery
                ? <li role="status">Searching accounts...</li>
                : filteredUsers.length === 0 && <li role="status">No accounts found.</li>
            )}
            {filteredUsers.map((name) => {
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
                          {friend ? <CheckCircleIcon className="chat-ico" /> : <PlusIcon />}
                        </button>
                        <button
                          type="button"
                          className="chat-users-action is-message"
                          aria-label={`Message ${name}`}
                          onClick={() => startChatWithUser(name)}
                        >
                          <PersonIcon />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
          </ul>
          <div className="chat-users-dock">
            <div className="chat-users-bar">
              <button
                type="button"
                className="chat-users-back"
                aria-label="Back"
                onClick={closeUsersPicker}
              >
                <BackIcon />
              </button>
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
        </StageSlot>
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
          searchStatus={groupNameStep ? '' : accountSearchError || (accountQuery
            ? accountSearch.loading || accountSearch.query !== accountQuery
              ? 'Searching accounts...'
              : allMemberNames.length === 0 ? 'No accounts found.' : ''
            : 'Search for an account')}
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
