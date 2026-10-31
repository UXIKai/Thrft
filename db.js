/**
 * PostgreSQL data layer (Prisma) — replaces the former SQLite + demo seed store.
 */
import { randomBytes } from 'node:crypto'
import { normalizeConnections } from './connect.js'
import { prisma } from './prisma.js'

function asArray(v) {
  return Array.isArray(v) ? v : []
}

function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function emptyProfile() {
  return {
    email: '',
    displayName: '',
    joined: '',
    updatedAt: new Date().toISOString(),
    identityStatus: 'unverified',
    identityProvider: '',
    identityRef: '',
    legalName: '',
    profileLinks: [],
    suppliers: [],
    avatarUrl: '',
    identityEmail: '',
    identityScope: '',
    identityVerifiedAt: '',
    identityGroups: [],
    clothingSizes: {},
    favoredBrands: [],
    brandSizes: {},
    shippingAddress: '',
    accountId: null,
    authProvider: '',
    connections: normalizeConnections({}),
  }
}

function mapProfile(row) {
  if (!row) return emptyProfile()
  return {
    email: row.email || '',
    displayName: row.displayName || '',
    joined: row.joined || '',
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt || ''),
    identityStatus: row.identityStatus || 'unverified',
    identityProvider: row.identityProvider || '',
    identityRef: row.identityRef || '',
    legalName: row.legalName || '',
    profileLinks: asArray(row.profileLinks),
    suppliers: asArray(row.suppliers),
    avatarUrl: row.avatarUrl || '',
    identityEmail: row.identityEmail || '',
    identityScope: row.identityScope || '',
    identityVerifiedAt: row.identityVerifiedAt || '',
    identityGroups: asArray(row.identityGroups),
    clothingSizes: asObject(row.clothingSizes),
    favoredBrands: asArray(row.favoredBrands),
    brandSizes: asObject(row.brandSizes),
    shippingAddress: row.shippingAddress || '',
    accountId: row.accountId ?? null,
    authProvider: row.authProvider || '',
    connections: normalizeConnections(asObject(row.connections)),
  }
}

export function mapAccount(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    username: row.username || '',
    bio: row.bio || '',
    provider: row.provider,
    providerSub: row.providerSub,
    avatarUrl: row.avatarUrl || '',
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
  }
}

export function mapProduct(row) {
  if (!row) return null
  return {
    id: row.id,
    accountId: row.accountId,
    title: row.title,
    brand: row.brand || '',
    category: row.category || '',
    price: row.price || '',
    condition: row.condition || '',
    description: row.description || '',
    segment: row.segment || 'store',
    status: row.status || 'active',
    photoUrl: row.photoUrl || '',
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
    sellerUsername: row.account?.username || undefined,
    sellerName: row.account?.displayName || undefined,
  }
}

export function slugifyUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .slice(0, 24)
}

export async function findAccountByUsername(username) {
  const u = slugifyUsername(username)
  if (!u) return null
  return prisma.account.findFirst({
    where: { username: { equals: u, mode: 'insensitive' } },
  })
}

export async function allocateUsername(preferred) {
  const base = slugifyUsername(preferred) || 'member'
  let candidate = base
  let n = 0
  while (await findAccountByUsername(candidate)) {
    n += 1
    candidate = `${base}${n}`.slice(0, 24)
  }
  return candidate
}

/** Active profile — prefers account-linked row; otherwise empty (no demo seed). */
export async function getProfile(accountId = null) {
  if (accountId != null) {
    const row = await prisma.userProfile.findUnique({ where: { accountId } })
    if (row) return mapProfile(row)
  }
  const any = await prisma.userProfile.findFirst({ orderBy: { id: 'asc' } })
  return mapProfile(any)
}

export async function updateProfile(patch = {}, accountId = null) {
  const current = await getProfile(accountId ?? patch.accountId ?? null)
  const statusOk = ['unverified', 'pending', 'verified']
  const data = {
    displayName:
      typeof patch.displayName === 'string' && patch.displayName.trim()
        ? patch.displayName.trim().slice(0, 64)
        : current.displayName,
    email:
      typeof patch.email === 'string' && patch.email.trim()
        ? patch.email.trim().slice(0, 120)
        : current.email,
    identityStatus: statusOk.includes(patch.identityStatus)
      ? patch.identityStatus
      : current.identityStatus,
    identityProvider:
      typeof patch.identityProvider === 'string'
        ? patch.identityProvider.slice(0, 40)
        : current.identityProvider,
    identityRef:
      typeof patch.identityRef === 'string'
        ? patch.identityRef.slice(0, 64)
        : current.identityRef,
    legalName:
      typeof patch.legalName === 'string'
        ? patch.legalName.trim().slice(0, 80)
        : current.legalName,
    profileLinks: Array.isArray(patch.profileLinks)
      ? patch.profileLinks.slice(0, 12)
      : current.profileLinks,
    suppliers: Array.isArray(patch.suppliers)
      ? patch.suppliers.slice(0, 24)
      : current.suppliers,
    avatarUrl:
      typeof patch.avatarUrl === 'string'
        ? patch.avatarUrl.slice(0, 900_000)
        : current.avatarUrl,
    identityEmail:
      typeof patch.identityEmail === 'string'
        ? patch.identityEmail.trim().slice(0, 120)
        : current.identityEmail,
    identityScope:
      typeof patch.identityScope === 'string'
        ? patch.identityScope.slice(0, 120)
        : current.identityScope,
    identityVerifiedAt:
      typeof patch.identityVerifiedAt === 'string'
        ? patch.identityVerifiedAt.slice(0, 40)
        : current.identityVerifiedAt,
    identityGroups: Array.isArray(patch.identityGroups)
      ? patch.identityGroups.slice(0, 20)
      : current.identityGroups,
    clothingSizes:
      patch.clothingSizes && typeof patch.clothingSizes === 'object'
        ? patch.clothingSizes
        : current.clothingSizes,
    favoredBrands: Array.isArray(patch.favoredBrands)
      ? patch.favoredBrands.slice(0, 40)
      : current.favoredBrands,
    brandSizes:
      patch.brandSizes && typeof patch.brandSizes === 'object'
        ? patch.brandSizes
        : current.brandSizes,
    shippingAddress:
      typeof patch.shippingAddress === 'string'
        ? patch.shippingAddress.trim().slice(0, 240)
        : current.shippingAddress,
    authProvider:
      typeof patch.authProvider === 'string'
        ? patch.authProvider.slice(0, 40)
        : current.authProvider,
    connections: normalizeConnections(
      patch.connections && typeof patch.connections === 'object'
        ? patch.connections
        : current.connections,
    ),
  }

  const linkId =
    patch.accountId === null
      ? null
      : typeof patch.accountId === 'number'
        ? patch.accountId
        : accountId ?? current.accountId

  if (!data.joined) {
    data.joined = current.joined || new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  let row
  if (linkId != null) {
    row = await prisma.userProfile.upsert({
      where: { accountId: linkId },
      create: { ...data, accountId: linkId, joined: data.joined },
      update: data,
    })
  } else {
    const existing = await prisma.userProfile.findFirst({ orderBy: { id: 'asc' } })
    if (existing) {
      row = await prisma.userProfile.update({
        where: { id: existing.id },
        data,
      })
    } else {
      row = await prisma.userProfile.create({
        data: { ...data, joined: data.joined },
      })
    }
  }
  return mapProfile(row)
}

export async function findAccountByEmail(email) {
  const e = String(email || '').trim()
  if (!e) return null
  return prisma.account.findFirst({
    where: { email: { equals: e, mode: 'insensitive' } },
  })
}

export async function findAccountByProvider(provider, providerSub) {
  return prisma.account.findUnique({
    where: {
      provider_providerSub: {
        provider: String(provider || ''),
        providerSub: String(providerSub || ''),
      },
    },
  })
}

export async function findAccountById(id) {
  if (id == null) return null
  return prisma.account.findUnique({ where: { id: Number(id) } })
}

export async function createAccount({
  email,
  displayName = '',
  passwordHash = '',
  provider = 'email',
  providerSub = '',
  avatarUrl = '',
  username = '',
  bio = '',
} = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const name = displayName || cleanEmail.split('@')[0] || 'Member'
  const handle = await allocateUsername(username || name || cleanEmail.split('@')[0])
  const row = await prisma.account.create({
    data: {
      email: cleanEmail,
      displayName: name,
      passwordHash: passwordHash || '',
      provider,
      providerSub: providerSub || cleanEmail,
      avatarUrl: avatarUrl || '',
      username: handle,
      bio: bio || '',
    },
  })
  return row
}

export async function updateAccount(accountId, patch = {}) {
  const current = await findAccountById(accountId)
  if (!current) return null
  let nextUsername = current.username
  if (typeof patch.username === 'string' && patch.username.trim()) {
    const wanted = slugifyUsername(patch.username)
    const taken = await findAccountByUsername(wanted)
    if (taken && taken.id !== accountId) {
      const err = new Error('Username taken')
      err.code = 'username_taken'
      throw err
    }
    nextUsername = wanted
  }
  return prisma.account.update({
    where: { id: accountId },
    data: {
      displayName:
        typeof patch.displayName === 'string'
          ? patch.displayName.trim().slice(0, 64)
          : current.displayName,
      username: nextUsername,
      bio: typeof patch.bio === 'string' ? patch.bio.slice(0, 280) : current.bio,
      avatarUrl:
        typeof patch.avatarUrl === 'string'
          ? patch.avatarUrl.slice(0, 900_000)
          : current.avatarUrl,
    },
  })
}

export async function getPublicAccount(username) {
  const row = await findAccountByUsername(username)
  if (!row) return null
  const account = mapAccount(row)
  return {
    username: account.username,
    displayName: account.displayName,
    bio: account.bio,
    avatarUrl: account.avatarUrl,
    id: account.id,
  }
}

export async function listProductsForAccount(
  accountId,
  { status, segment } = {},
) {
  const where = { accountId: Number(accountId) }
  if (status) where.status = status
  if (segment) where.segment = segment
  const rows = await prisma.product.findMany({
    where,
    include: { account: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapProduct)
}

/** Recent products across accounts (For You ranking — no mock catalog). */
export async function listProducts({ limit = 200, status } = {}) {
  const where = {}
  if (status) where.status = status
  const rows = await prisma.product.findMany({
    where,
    include: { account: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, Math.max(1, Number(limit) || 200)),
  })
  return rows.map(mapProduct)
}

export async function getProduct(id) {
  const row = await prisma.product.findUnique({
    where: { id: String(id || '') },
    include: { account: { select: { username: true, displayName: true } } },
  })
  return mapProduct(row)
}

export async function createProduct(accountId, input = {}) {
  const id = String(input.id || `p_${randomBytes(8).toString('hex')}`)
  const row = await prisma.product.create({
    data: {
      id,
      accountId: Number(accountId),
      title: String(input.title || 'Listing').slice(0, 120),
      brand: String(input.brand || '').slice(0, 80),
      category: String(input.category || '').slice(0, 80),
      price: String(input.price || '').slice(0, 40),
      condition: String(input.condition || '').slice(0, 40),
      description: String(input.description || '').slice(0, 2000),
      segment: String(input.segment || 'store').slice(0, 40),
      status: String(input.status || 'active').slice(0, 40),
      photoUrl: String(input.photoUrl || '').slice(0, 900_000),
    },
    include: { account: { select: { username: true, displayName: true } } },
  })
  return mapProduct(row)
}

export async function updateProduct(id, accountId, patch = {}) {
  const current = await prisma.product.findFirst({
    where: { id: String(id), accountId: Number(accountId) },
  })
  if (!current) return null
  const row = await prisma.product.update({
    where: { id: current.id },
    data: {
      title:
        typeof patch.title === 'string'
          ? patch.title.slice(0, 120)
          : current.title,
      brand:
        typeof patch.brand === 'string' ? patch.brand.slice(0, 80) : current.brand,
      category:
        typeof patch.category === 'string'
          ? patch.category.slice(0, 80)
          : current.category,
      price:
        typeof patch.price === 'string' ? patch.price.slice(0, 40) : current.price,
      condition:
        typeof patch.condition === 'string'
          ? patch.condition.slice(0, 40)
          : current.condition,
      description:
        typeof patch.description === 'string'
          ? patch.description.slice(0, 2000)
          : current.description,
      segment:
        typeof patch.segment === 'string'
          ? patch.segment.slice(0, 40)
          : current.segment,
      status:
        typeof patch.status === 'string'
          ? patch.status.slice(0, 40)
          : current.status,
      photoUrl:
        typeof patch.photoUrl === 'string'
          ? patch.photoUrl.slice(0, 900_000)
          : current.photoUrl,
    },
    include: { account: { select: { username: true, displayName: true } } },
  })
  return mapProduct(row)
}

export async function deleteProduct(id, accountId) {
  const result = await prisma.product.deleteMany({
    where: { id: String(id), accountId: Number(accountId) },
  })
  return result.count > 0
}

export async function createSession(accountId, { days = 30 } = {}) {
  const token = randomBytes(32).toString('hex')
  const created = new Date()
  const expires = new Date(created.getTime() + days * 24 * 60 * 60 * 1000)
  await prisma.session.create({
    data: {
      token,
      accountId: Number(accountId),
      createdAt: created,
      expiresAt: expires,
    },
  })
  return {
    token,
    accountId: Number(accountId),
    createdAt: created.toISOString(),
    expiresAt: expires.toISOString(),
  }
}

export async function getSession(token) {
  if (!token) return null
  const row = await prisma.session.findUnique({ where: { token: String(token) } })
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token: row.token } }).catch(() => {})
    return null
  }
  return {
    token: row.token,
    accountId: row.accountId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }
}

export async function deleteSession(token) {
  if (!token) return
  await prisma.session.deleteMany({ where: { token: String(token) } })
}

export async function activateAccountSession(account) {
  const session = await createSession(account.id)
  const profile = await updateProfile(
    {
      email: account.email,
      displayName: account.displayName || account.email.split('@')[0],
      avatarUrl: account.avatarUrl || undefined,
      accountId: account.id,
      authProvider: account.provider,
    },
    account.id,
  )
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    account: mapAccount(account),
    profile,
  }
}

export async function listAccounts() {
  const rows = await prisma.account.findMany({ orderBy: { id: 'asc' } })
  return rows.map(mapAccount)
}

export async function listSaved() {
  const rows = await prisma.savedItem.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map((r) => {
    const payload = r.payload
    if (payload && typeof payload === 'object') return payload
    return { id: r.id }
  })
}

export async function replaceSaved(items) {
  const list = Array.isArray(items) ? items : []
  await prisma.$transaction(async (tx) => {
    await tx.savedItem.deleteMany()
    for (const item of list) {
      if (!item?.id) continue
      await tx.savedItem.create({
        data: {
          id: String(item.id),
          payload: item,
        },
      })
    }
  })
  return listSaved()
}

export function dbFilePath() {
  return process.env.DATABASE_URL ? 'postgresql' : ''
}

export async function insertInterestEvent(row) {
  await prisma.interestEvent.create({
    data: {
      id: row.id,
      accountKey: row.accountKey,
      kind: row.kind,
      productId: row.productId || '',
      brandId: row.brandId || '',
      clothingType: row.clothingType || '',
      query: row.query || '',
      weight: row.weight ?? 1,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    },
  })
  return row
}

export async function listInterestEvents(accountKey, limit = 400) {
  const rows = await prisma.interestEvent.findMany({
    where: { accountKey: String(accountKey || 'guest') },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => ({
    kind: r.kind,
    productId: r.productId,
    brandId: r.brandId,
    clothingType: r.clothingType,
    query: r.query,
    weight: r.weight,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function saveCheckoutOrder(row) {
  await prisma.checkoutOrder.upsert({
    where: { id: row.id },
    create: {
      id: row.id,
      accountKey: row.accountKey || '',
      productId: row.productId || '',
      title: row.title || '',
      amountTotal: row.amountTotal || 0,
      currency: row.currency || 'usd',
      status: row.status || 'open',
      mode: row.mode || 'live',
    },
    update: {
      status: row.status || 'open',
      amountTotal: row.amountTotal || 0,
    },
  })
  return row
}

export async function getCheckoutOrder(id) {
  const row = await prisma.checkoutOrder.findUnique({
    where: { id: String(id || '') },
  })
  if (!row) return null
  return {
    id: row.id,
    accountKey: row.accountKey,
    productId: row.productId,
    title: row.title,
    amountTotal: row.amountTotal,
    currency: row.currency,
    status: row.status,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
