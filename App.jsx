import { useEffect, useMemo, useRef, useState } from 'react'
import AccountPage from './components/AccountPage.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import BrandProfile from './components/BrandProfile.jsx'
import Bubble from './components/Bubble.jsx'
import BrandGlobe from './components/BrandGlobe.jsx'
import ClothingTypePage from './components/ClothingTypePage.jsx'
import ChatScreen from './components/ChatScreen.jsx'
import CreateListing from './components/CreateListing.jsx'
import HomeFilterLinks from './components/HomeFilterLinks.jsx'
import LiquidGlassDefs from './components/LiquidGlassDefs.jsx'
import CartScreen from './components/CartScreen.jsx'
import ProductDetail from './components/ProductDetail.jsx'
import ProductRows from './components/ProductRows.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import SavedScreen from './components/SavedScreen.jsx'
import TabBar from './components/TabBar.jsx'
import { useBag } from './BagContext.jsx'
import {
  INITIAL_PROFILES,
  sortByProfit,
} from './profiles.js'
import {
  BUBBLE,
  slotForRank,
} from './layout.js'
import { applyBackgroundImage } from './appAppearance.js'
import {
  fetchProfile,
  fetchSaved,
  saveProfile,
  recordInterest,
} from './api.js'
import {
  getAuthSession,
  requireAuthSession,
  onAuthChange,
  signOut,
} from './auth.js'
import { getClothingTypes } from './clothingTypes.js'
import { recordProductInterest, recordSearchHistory } from './forYou.js'
import { LISTING_BRANDS } from './listingCatalog.js'
import { SIZE_BRANDS } from './sizeOptions.js'
import './App.css'

function slugBrand(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40) || 'brand'
  )
}

function brandIdForName(name) {
  const n = String(name || '').toLowerCase()
  const known = SIZE_BRANDS.find(
    (b) =>
      b.name.toLowerCase() === n ||
      b.id === n ||
      b.name.toLowerCase().replace(/^the\s+/, '') === n.replace(/^the\s+/, ''),
  )
  if (known) return known.id
  if (n === 'vuitton' || n === 'louis vuitton') return 'lv'
  if (n === 'north face' || n === 'thenorthface') return 'northface'
  if (n === "levi's" || n === 'levis') return 'levis'
  return slugBrand(name)
}

function buildHomeBrandItems() {
  const byId = new Map()
  for (const b of SIZE_BRANDS) {
    byId.set(b.id, { id: b.id, label: b.name })
  }
  for (const name of LISTING_BRANDS) {
    if (name === 'Other') continue
    const id = brandIdForName(name)
    if (!byId.has(id)) byId.set(id, { id, label: name })
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label))
}

const HOME_BRAND_ITEMS = buildHomeBrandItems()

function buildHomeCategoryItems() {
  return getClothingTypes()
    .filter((t) => t.id !== 'all')
    .map((t) => ({ id: t.id, label: t.label }))
}

function CartIcon() {
  return (
    <svg className="home-checkout-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 5h1.6l1.4 10.2a1.4 1.4 0 0 0 1.4 1.2h8.7a1.4 1.4 0 0 0 1.4-1.1L19.5 8H7"
      />
      <circle cx="9.2" cy="19" r="1.25" fill="currentColor" />
      <circle cx="16.3" cy="19" r="1.25" fill="currentColor" />
    </svg>
  )
}

export default function App() {
  const [profiles] = useState(INITIAL_PROFILES)
  const [order] = useState(() =>
    sortByProfit(INITIAL_PROFILES).map((p) => p.id),
  )
  const [tab, setTab] = useState('home')
  const [clothingType, setClothingType] = useState('all')
  const [homeBrand, setHomeBrand] = useState(null) // { id, label } | null
  const [homePicker, setHomePicker] = useState(null) // 'brands' | 'category' | null
  const [homePickerPhase, setHomePickerPhase] = useState('closed')
  const [homePickerQuery, setHomePickerQuery] = useState('')
  const [activeTypePage, setActiveTypePage] = useState(null) // type id or null
  const [stageW, setStageW] = useState(390)
  const homeCategoryItems = useMemo(() => buildHomeCategoryItems(), [])
  // Dashboard stays locked until a verified Supabase session exists.
  const [signedIn, setSignedIn] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authReady, setAuthReady] = useState(false)
  const [activeProduct, setActiveProduct] = useState(null)
  const [activeBrand, setActiveBrand] = useState(null)
  const [activeAccount, setActiveAccount] = useState(null) // { username, isOwn }
  const [account, setAccount] = useState(null)
  const [userProfile, setUserProfile] = useState({
    email: '',
    displayName: '',
    joined: '',
    identityStatus: 'unverified',
    identityProvider: '',
    identityRef: '',
    legalName: '',
    profileLinks: [],
    socialHandles: {
      tiktok: '',
      x: '',
      instagram: '',
      snapchat: '',
      rednote: '',
    },
    suppliers: [],
    avatarUrl: '',
    clothingSizes: {},
    favoredBrands: [],
    brandSizes: {},
    shippingAddress: '',
    storeApiKey: '',
    connections: {
      shopify: { connected: false, shop: '', connectedAt: '' },
      stripe: { connected: false, accountId: '', connectedAt: '' },
      bank: { connected: false, last4: '', bankName: '', connectedAt: '' },
    },
  })
  const [savedIds, setSavedIds] = useState([])
  const [forYouRefresh, setForYouRefresh] = useState(0)
  const [feedRefresh, setFeedRefresh] = useState(0)
  const [cartOpen, setCartOpen] = useState(false)
  const [chatThreadOpen, setChatThreadOpen] = useState(false)
  const { items: cartItems, count: bagCount, addItem, replaceItems, empty } =
    useBag()
  const stageRef = useRef(null)
  const scrollRef = useRef(null)
  const hideTabBar = tab === 'chat' || tab === 'saved'

  const byId = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  )

  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => {
      setStageW(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Always keep the flowing B/W/gray atmosphere behind the stage.
  useEffect(() => {
    applyBackgroundImage('atmosphere')
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    stage.classList.toggle('is-overlay-open', !signedIn)
    return () => stage.classList.remove('is-overlay-open')
  }, [signedIn])

  function applySession(session) {
    if (session?.user || session?.token) {
      if (session.profile) {
        setUserProfile({
          ...session.profile,
          username: session.account?.username || session.profile.username || '',
        })
      }
      setAccount(session.account || null)
      setSignedIn(true)
      return true
    }
    setSignedIn(false)
    setAccount(null)
    return false
  }

  // Boot: verify Supabase session (server-side getUser). Block dashboard if missing.
  useEffect(() => {
    let alive = true
    ;(async () => {
      // Local OAuth return: ?auth=ok&token=…
      const params = new URLSearchParams(window.location.search)
      const authFlag = params.get('auth')
      const oauthToken = params.get('token')
      if (authFlag === 'ok' && oauthToken) {
        try {
          localStorage.setItem('thrft-session-v1', oauthToken)
        } catch {
          /* ignore */
        }
      }
      if (params.has('auth') || params.has('token')) {
        params.delete('auth')
        params.delete('token')
        params.delete('provider')
        params.delete('reason')
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
        window.history.replaceState({}, '', next)
      }

      // Supabase when configured; otherwise local API session
      let session = null
      try {
        session = await requireAuthSession()
      } catch {
        session = null
      }
      if (!session) session = await getAuthSession()
      if (!alive) return
      applySession(session)
      setAuthReady(true)

      if (session) {
        const profile = await fetchProfile().catch(() => null)
        if (alive && profile) {
          setUserProfile((prev) => ({
            ...prev,
            ...profile,
            email: session.profile?.email || profile.email || prev.email,
            displayName:
              session.profile?.displayName ||
              profile.displayName ||
              prev.displayName,
            username:
              session.account?.username ||
              profile.username ||
              prev.username ||
              '',
          }))
        }
        const items = await fetchSaved().catch(() => null)
        if (alive && Array.isArray(items)) {
          setSavedIds(
            items.map((it) => it?.id || it?.productId).filter(Boolean),
          )
        }
      }
    })()

    const stop = onAuthChange((session) => {
      if (!alive) return
      applySession(session)
      setAuthReady(true)
    })

    return () => {
      alive = false
      stop()
    }
  }, [])

  // Return from ID.me OAuth callback (?idme=verified|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('idme')
    if (!flag) return undefined
    let alive = true
    fetchProfile().then((profile) => {
      if (!alive || !profile) return
      setUserProfile(profile)
      if (flag === 'verified') setTab('profile')
    })
    params.delete('idme')
    params.delete('reason')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
    return () => {
      alive = false
    }
  }, [])

  // Stripe Checkout return (?checkout=success|cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('checkout')
    if (!flag) return
    if (flag === 'success') {
      empty()
      setCartOpen(false)
    }
    params.delete('checkout')
    params.delete('session_id')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
    return undefined
  }, [])

  async function handleSaveProfile(patch) {
    const result = await saveProfile(patch)
    setUserProfile(result.profile)
    if (patch && typeof patch.username === 'string' && patch.username.trim()) {
      const nextUsername = patch.username.trim().replace(/^@+/, '')
      setAccount((prev) =>
        prev ? { ...prev, username: nextUsername } : { username: nextUsername },
      )
    }
    return result
  }

  useEffect(() => {
    const stage = stageRef.current || document.querySelector('.stage')
    if (!stage) return undefined
    const open = homePickerPhase !== 'closed'
    stage.classList.toggle('is-home-picker-open', open)
    return () => stage.classList.remove('is-home-picker-open')
  }, [homePickerPhase])

  function openHomePicker(kind) {
    setHomePickerQuery('')
    setHomePicker(kind)
    setHomePickerPhase('enter')
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHomePickerPhase('open'))
    })
  }

  function closeHomePicker() {
    setHomePickerPhase('exit')
  }

  function onHomePickerExitComplete() {
    setHomePicker(null)
    setHomePickerPhase('closed')
    setHomePickerQuery('')
  }

  const homePickerItems = useMemo(() => {
    const source =
      homePicker === 'brands' ? HOME_BRAND_ITEMS : homeCategoryItems
    const q = homePickerQuery.trim().toLowerCase()
    if (!q) return source
    return source.filter(
      (item) =>
        String(item.label || '')
          .toLowerCase()
          .includes(q) ||
        String(item.id || '')
          .toLowerCase()
          .includes(q),
    )
  }, [homePicker, homeCategoryItems, homePickerQuery])

  function handleHomeBrandPick(brandId) {
    const item = HOME_BRAND_ITEMS.find((b) => b.id === brandId)
    if (!item) return
    setHomeBrand(item)
    recordSearchHistory({
      kind: 'search',
      brandId: item.id,
      brandName: item.label,
      query: item.label,
    })
    recordInterest({
      kind: 'search',
      brandId: item.id,
      query: item.label,
    }).then(() => setForYouRefresh((n) => n + 1))
    closeHomePicker()
  }

  function handleHomeCategoryPick(typeId) {
    setClothingType(typeId || 'all')
    if (!typeId || typeId === 'all') setActiveTypePage(null)
    if (typeId && typeId !== 'all') {
      recordSearchHistory({
        kind: 'search',
        clothingType: typeId,
        query: typeId,
      })
    }
    recordInterest({
      kind: 'search',
      clothingType: typeId,
      query: typeId,
    }).then(() => setForYouRefresh((n) => n + 1))
    closeHomePicker()
  }

  const homeCategoryLabel =
    clothingType && clothingType !== 'all'
      ? homeCategoryItems.find((c) => c.id === clothingType)?.label || null
      : null

  function handleOpenProduct(product) {
    recordProductInterest(product, 1)
    recordInterest({
      kind: 'view',
      productId: product?.id,
      brandId: product?.brandId,
      clothingType: product?.clothingType,
    }).then(() => setForYouRefresh((n) => n + 1))
    setActiveProduct(product)
  }

  return (
    <div
      className="stage"
      ref={stageRef}
      style={{ '--bubble-size': `${BUBBLE}px` }}
    >
      <LiquidGlassDefs />
      <div className="atmosphere" aria-hidden>
        <span className="atmosphere-bloom atmosphere-bloom-a" />
        <span className="atmosphere-bloom atmosphere-bloom-b" />
        <span className="atmosphere-bloom atmosphere-bloom-c" />
        <span className="atmosphere-bloom atmosphere-bloom-d" />
      </div>

      {signedIn && (
        <>
      <div
        className={`home-scroll${hideTabBar ? ' is-chat-thread' : ''}`}
        ref={scrollRef}
      >
        {tab === 'home' && (
          <>
            <header className="wordmark-wrap">
              <span className="wordmark-side" aria-hidden />
              <h1 className="wordmark">
                Thrft<span className="dot" aria-hidden="true">●</span>
              </h1>
              <button
                type="button"
                className="home-checkout-btn"
                aria-label={bagCount ? `Bag, ${bagCount} items` : 'Bag'}
                onClick={() => setCartOpen(true)}
              >
                <CartIcon />
                {bagCount > 0 ? (
                  <span className="home-checkout-badge">{bagCount > 9 ? '9+' : bagCount}</span>
                ) : null}
              </button>
            </header>

            <section
              className="leaderboard-panel"
              aria-label="Account ranks by profit"
            >
              <div className="helix helix-embedded">
                {order.map((id, i) => {
                  const profile = byId.get(id)
                  if (!profile) return null
                  const rank = i + 1
                  const pos = slotForRank(rank, stageW)
                  return (
                    <Bubble
                      key={id}
                      profile={profile}
                      rank={rank}
                      x={pos.x}
                      y={pos.y}
                    />
                  )
                })}
              </div>
            </section>

            <HomeFilterLinks
              brandLabel={homeBrand?.label || null}
              categoryLabel={homeCategoryLabel}
              onOpenBrands={() => openHomePicker('brands')}
              onOpenCategory={() => openHomePicker('category')}
            />

            <ProductRows
              onOpenProduct={handleOpenProduct}
              clothingType={clothingType}
              brandId={homeBrand?.id || ''}
              brandName={homeBrand?.label || ''}
              forYouRefresh={forYouRefresh}
              feedRefresh={feedRefresh}
              favoredBrands={userProfile?.favoredBrands || []}
              clothingSizes={userProfile?.clothingSizes || {}}
              brandSizes={userProfile?.brandSizes || {}}
              savedProductIds={userProfile?.savedProductIds || []}
            />
          </>
        )}

        {tab === 'design' && (
          <CreateListing
            onPosted={() => {
              setFeedRefresh((n) => n + 1)
              setForYouRefresh((n) => n + 1)
            }}
          />
        )}

        {tab === 'chat' && (
          <ChatScreen
            onBack={() => setTab('home')}
            onThreadActiveChange={setChatThreadOpen}
            onOpenAccount={(username) => {
              if (!username) return
              setActiveAccount({ username, isOwn: false })
            }}
          />
        )}

        {tab === 'saved' && (
          <SavedScreen
            onBack={() => setTab('home')}
            onOpenProduct={setActiveProduct}
            favoredBrands={userProfile?.favoredBrands || []}
            onFavoredBrandsChange={async (next) => {
              await handleSaveProfile({ favoredBrands: next })
            }}
            onForYouRefresh={() => setForYouRefresh((n) => n + 1)}
          />
        )}

        {tab === 'profile' && (
          <ProfileScreen
            userProfile={{
              ...userProfile,
              username: account?.username || userProfile?.username || '',
            }}
            account={account}
            onSaveProfile={handleSaveProfile}
            onPostListing={() => setTab('design')}
            onOpenAccountPage={() => {
              const username = account?.username || userProfile?.username
              if (!username) return
              setActiveAccount({ username, isOwn: true })
            }}
            onOpenProduct={setActiveProduct}
            onSignOut={async () => {
              await signOut()
              setSignedIn(false)
              setAccount(null)
              setAuthMode('login')
              setTab('home')
            }}
          />
        )}
      </div>

      {!hideTabBar && <TabBar active={tab} onChange={setTab} />}

      {activeProduct && (
        <ProductDetail
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
          onOpenBrand={(brandId, brandName) => {
            setActiveProduct(null)
            setActiveBrand({ brandId, brandName })
          }}
          onAddToCart={(product) => {
            addItem(product)
          }}
        />
      )}

      {cartOpen && (
        <CartScreen
          items={cartItems}
          shippingAddress={userProfile?.shippingAddress || ''}
          onClose={() => setCartOpen(false)}
          onChange={replaceItems}
          onOpenProduct={(product) => {
            setCartOpen(false)
            setActiveProduct(product)
          }}
        />
      )}

      {activeBrand && (
        <BrandProfile
          brandId={activeBrand.brandId}
          brandName={activeBrand.brandName}
          onClose={() => setActiveBrand(null)}
          onOpenProduct={(product) => {
            setActiveBrand(null)
            setActiveProduct(product)
          }}
        />
      )}

      {activeTypePage && (
        <ClothingTypePage
          typeId={activeTypePage}
          onClose={() => setActiveTypePage(null)}
          onOpenProduct={(product) => {
            setActiveTypePage(null)
            setActiveProduct(product)
          }}
        />
      )}

      {homePickerPhase !== 'closed' && homePicker && (
        <BrandGlobe
          variant="dock"
          phase={
            homePickerPhase === 'enter'
              ? 'enter'
              : homePickerPhase === 'exit'
                ? 'exit'
                : 'open'
          }
          brands={homePickerItems}
          activeId={
            homePicker === 'brands'
              ? homeBrand?.id || ''
              : clothingType === 'all'
                ? ''
                : clothingType
          }
          title={homePicker === 'brands' ? 'Brands' : 'Category'}
          snug={homePicker !== 'brands'}
          searchValue={homePickerQuery}
          onSearchChange={setHomePickerQuery}
          searchPlaceholder=""
          onSelect={
            homePicker === 'brands'
              ? handleHomeBrandPick
              : handleHomeCategoryPick
          }
          onClose={closeHomePicker}
          onExitComplete={onHomePickerExitComplete}
        />
      )}

      {activeAccount && (
        <AccountPage
          username={activeAccount.username}
          isOwn={Boolean(activeAccount.isOwn)}
          onClose={() => setActiveAccount(null)}
          onOpenProduct={(product) => setActiveProduct(product)}
        />
      )}
        </>
      )}

      {authReady && !signedIn && (
        <AuthScreen
          mode={authMode}
          onEnter={(result) => {
            applySession(result)
            setAuthMode('login')
            setTab('home')
          }}
          onSwitchMode={() =>
            setAuthMode((m) => (m === 'login' ? 'signup' : 'login'))
          }
        />
      )}
    </div>
  )
}
