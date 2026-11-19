import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AtmosphereFlow from './AtmosphereFlow.jsx'
import {
  connectProvider,
  fetchAccountPage,
  fetchMyProducts,
  initialsFromName,
  updateListingProduct,
} from '../api.js'
import {
  fetchClosetItems,
  filterClosetItems,
  removeClosetItem,
} from '../closet.js'
import { getCustomBrands, getCustomCategories } from '../customCatalog.js'
import ClosetNumberLookup from './ClosetNumberLookup.jsx'
import { LISTING_BRANDS, LISTING_CATEGORIES } from '../listingCatalog.js'
import { createListing, fetchMyListings, fetchSellerSalesStats, formatListingPrice, isValidListingPrice, updateMyListing } from '../listings.js'
import { uploadCreatorArtwork, uploadProductPhoto } from '../artworkStorage.js'
import { compressImage, readCaptions, readProfileMedia, storeImage, writeCaption, writeProfileMedia } from '../profileMedia.js'
import { getSupabase, isSupabaseConfigured } from '../supabase.js'
import BrandGlobe from './BrandGlobe.jsx'
import GiveBack from './GiveBack.jsx'
import OrbitCarousel from './OrbitCarousel.jsx'
import OrdersScreen from './OrdersScreen.jsx'
import SectionSwiper from './SectionSwiper.jsx'
import StylstBoard from './StylstBoard.jsx'
import SettingsScreen from './SettingsScreen.jsx'
import SwipeBackPage from './SwipeBackPage.jsx'
import ProductPhoto from './ProductPhoto.jsx'
import FollowListSheet from './FollowListSheet.jsx'
import { hasProductCutout } from '../mockupCutouts.js'
import './GlassOverlay.css'
import './ProfileScreen.css'

function CameraBadge() {
  return (
    <svg className="profile-cam-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M9 5.5h6l1.2 1.5H18a1.8 1.8 0 0 1 1.8 1.8v8A1.8 1.8 0 0 1 18 18.6H6A1.8 1.8 0 0 1 4.2 16.8v-8A1.8 1.8 0 0 1 6 7h1.8L9 5.5zM12 9.2a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"
      />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
      <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d="m4.5 17 4.2-4.2 3 3 3.3-3.8 4.5 5" />
    </svg>
  )
}

function compressImageFile(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    img.src = url
  })
}

function ShirtIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M6.2 5.5H3.8A2.3 2.3 0 0 0 1.5 7.8v0A2.3 2.3 0 0 0 3.8 10.1h16.4a2.3 2.3 0 0 0 2.3-2.3v0a2.3 2.3 0 0 0-2.3-2.3H18" />
      <rect x="1.5" y="10.4" width="21" height="4.6" rx="2.3" />
      <rect x="1.5" y="15.3" width="21" height="4.6" rx="2.3" />
      <path d="M8 4h8l1.7 1.6-3.2 2.3L12 9.4l-2.5-1.5-3.2-2.3zM12 7.4l2.3 2M12 7.4l-2.1 2" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg className="profile-sparkle" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.2 13.4 8.6 19.8 10 13.4 11.4 12 17.8 10.6 11.4 4.2 10 10.6 8.6 12 2.2zm6.8 10.2.7 3.1 3.1.7-3.1.7-.7 3.1-.7-3.1-3.1-.7 3.1-.7.7-3.1z"
      />
    </svg>
  )
}

function WalletIcon({ className = 'profile-wallet-ico' } = {}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M3.5 7.2A2.2 2.2 0 0 1 5.7 5h11.1c.6 0 1.1.5 1.1 1.1V7H7.2A1.7 1.7 0 0 0 5.5 8.7v.8H5.7A2.2 2.2 0 0 1 3.5 7.2zm0 3.1h1.7v6.5A2.2 2.2 0 0 0 7.4 19h11.4a2.2 2.2 0 0 0 2.2-2.2V9.9a1.6 1.6 0 0 0-1.6-1.6H7.2a.5.5 0 0 1-.5-.5.5.5 0 0 1 .5-.5H18V6.6H5.7a.9.9 0 0 0-.9.9v2.8zm12.8 3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"
      />
    </svg>
  )
}

function MoneyIcon({ className = 'profile-money-ico' } = {}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      {/* Bank — stroke only, no filled plate */}
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10h16M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5M3.5 18.5h17M12 4.2 20 9H4l8-4.8z"
      />
    </svg>
  )
}

function SalesIcon() {
  return (
    <svg className="profile-money-tile-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 18.5V9.2h2.2v9.3H4.5zm6.4 0V5.5h2.2v13H10.9zm6.4 0v-6.2H19.5v6.2h-2.2z"
      />
    </svg>
  )
}

function DonateHandHeartIcon() {
  return (
    <span
      className="profile-points-action-ico is-donate"
      aria-hidden
    />
  )
}

function CashOutAtmIcon() {
  return (
    <span
      className="profile-points-action-ico is-cashout"
      aria-hidden
    />
  )
}

const SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', placeholder: 'username' },
  { id: 'x', label: 'X', placeholder: 'handle' },
  { id: 'instagram', label: 'Instagram', placeholder: 'username' },
  { id: 'snapchat', label: 'Snapchat', placeholder: 'username' },
  { id: 'rednote', label: 'RedNote', placeholder: 'username' },
]

const EMPTY_SOCIAL_HANDLES = {
  tiktok: '',
  x: '',
  instagram: '',
  snapchat: '',
  rednote: '',
}

function TikTokIcon() {
  return (
    <svg className="profile-social-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M14.2 3.2h2.1c.2 1.7 1.2 3.2 2.7 4.1v2.3c-1.1-.1-2.1-.5-3-1.1v6.3c0 3.1-2.5 5.6-5.6 5.6S4.8 17.9 4.8 14.8s2.5-5.6 5.6-5.6c.3 0 .6 0 .9.1v2.4c-.3-.1-.6-.2-.9-.2-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3.2z"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="profile-social-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="profile-social-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 7.4A4.6 4.6 0 1 0 16.6 12 4.6 4.6 0 0 0 12 7.4zm0 7.5A2.9 2.9 0 1 1 14.9 12 2.9 2.9 0 0 1 12 14.9zm5.9-8.6a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1zM12 3.6c-2.3 0-2.6 0-3.5.1a5 5 0 0 0-3.4 1.4A5 5 0 0 0 3.7 8.5c-.1.9-.1 1.2-.1 3.5s0 2.6.1 3.5a5 5 0 0 0 1.4 3.4 5 5 0 0 0 3.4 1.4c.9.1 1.2.1 3.5.1s2.6 0 3.5-.1a5 5 0 0 0 3.4-1.4 5 5 0 0 0 1.4-3.4c.1-.9.1-1.2.1-3.5s0-2.6-.1-3.5a5 5 0 0 0-1.4-3.4 5 5 0 0 0-3.4-1.4c-.9-.1-1.2-.1-3.5-.1zm0 1.6c2.3 0 2.5 0 3.4.1a3.4 3.4 0 0 1 2 2c.1.9.1 1.1.1 3.4s0 2.5-.1 3.4a3.4 3.4 0 0 1-2 2c-.9.1-1.1.1-3.4.1s-2.5 0-3.4-.1a3.4 3.4 0 0 1-2-2c-.1-.9-.1-1.1-.1-3.4s0-2.5.1-3.4a3.4 3.4 0 0 1 2-2c.9-.1 1.1-.1 3.4-.1z"
      />
    </svg>
  )
}

function SnapchatIcon() {
  return (
    <svg className="profile-social-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"
      />
    </svg>
  )
}

function RedNoteIcon() {
  // Xiaohongshu / RED wordmark (official mark)
  return (
    <svg className="profile-social-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z"
      />
    </svg>
  )
}

function socialIcon(id) {
  if (id === 'tiktok') return <TikTokIcon />
  if (id === 'x') return <XIcon />
  if (id === 'instagram') return <InstagramIcon />
  if (id === 'snapchat') return <SnapchatIcon />
  return <RedNoteIcon />
}

const MONEY_TABS = [
  { id: 'points', label: 'Points', Icon: SparkleIcon },
  { id: 'wallet', label: 'Wallet', Icon: WalletIcon },
  { id: 'sales', label: 'Sales', Icon: SalesIcon },
]

function BackIcon() {
  return (
    <svg className="profile-back-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 5.5 8 12l6.5 6.5"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="profile-name-person" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="6"
        y="11"
        width="12"
        height="9"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11"
      />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg className="profile-name-person" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="8.2"
        r="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M5.2 19.2c.7-3.4 3.2-5.2 6.8-5.2s6.1 1.8 6.8 5.2"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="profile-close-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 5.2 12 10.8l5.6-5.6 1.2 1.2L13.2 12l5.6 5.6-1.2 1.2L12 13.2l-5.6 5.6-1.2-1.2L10.8 12 5.2 6.4l1.2-1.2z"
      />
    </svg>
  )
}

function SpotifyIcon({ className = 'profile-music-brand-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        fill="#0a0a0a"
        d="M16.9 16.35c-.22.36-.68.48-1.04.26-2.85-1.74-6.44-2.14-10.66-1.17-.41.09-.82-.16-.91-.57-.1-.41.15-.82.56-.91 4.6-1.05 8.56-.6 11.78 1.36.36.22.48.68.27 1.03zm1.35-2.98c-.28.45-.86.6-1.31.32-3.26-2-8.23-2.58-12.08-1.41-.5.15-1.02-.13-1.17-.62-.15-.5.13-1.02.62-1.17 4.42-1.34 9.9-.69 13.63 1.61.45.28.6.86.31 1.27zm.12-3.1C14.7 7.9 8.35 7.68 5.2 8.64c-.6.18-1.23-.16-1.41-.75-.18-.6.16-1.23.75-1.41 3.62-1.1 10.64-.89 14.84 1.62.54.32.72 1.02.4 1.56-.32.54-1.02.72-1.56.4z"
      />
    </svg>
  )
}

function AppleMusicIcon({ className = 'profile-music-brand-ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="currentColor" />
      <path
        fill="#fff"
        d="M16.2 4.8v9.35a2.85 2.85 0 1 1-1.55-2.52V7.4l-5.3 1.1v7.05a2.85 2.85 0 1 1-1.55-2.52V6.55c0-.55.4-1.02.94-1.13l6.5-1.35c.66-.14 1.26.36 1.26 1.03z"
      />
    </svg>
  )
}

/** Mock parse of Spotify / Apple Music share links. */
function parseMusicLink(service, raw) {
  const url = (raw || '').trim()
  if (!url) return null
  const lower = url.toLowerCase()
  const isSpotify = service === 'spotify'
  let kind = 'link'
  let title = isSpotify ? 'Spotify link' : 'Apple Music link'
  let subtitle = url

  if (isSpotify) {
    if (lower.includes('/playlist/')) {
      kind = 'playlist'
      title = 'Liked / Shared Playlist'
      subtitle = 'Spotify playlist'
    } else if (
      lower.includes('/user/') ||
      lower.includes('/artist/') ||
      lower.includes('/open.spotify.com/')
    ) {
      kind = 'account'
      title = 'Spotify profile'
      subtitle = 'Artist or user account'
    }
  } else if (lower.includes('playlist') || lower.includes('/pl.')) {
    kind = 'playlist'
    title = 'Apple Music playlist'
    subtitle = 'Shared playlist'
  } else if (lower.includes('/profile') || lower.includes('music.apple.com')) {
    kind = 'account'
    title = 'Apple Music profile'
    subtitle = 'Artist or user account'
  }

  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = u.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    if (last && kind === 'playlist') {
      title = decodeURIComponent(last.replace(/[-_]/g, ' ')).slice(0, 42) || title
    }
  } catch {
    /* keep defaults */
  }

  return { service, kind, title, subtitle, url }
}

function LinkIcon() {
  return (
    <svg className="profile-link-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.2 13.8 13.8 10.2M9.4 6.4l1.7-1.7a4.1 4.1 0 0 1 5.8 5.8l-1.7 1.7M14.6 17.6l-1.7 1.7a4.1 4.1 0 0 1-5.8-5.8l1.7-1.7"
      />
    </svg>
  )
}

function EmptyBoxIcon() {
  return (
    <svg className="pf-empty-state-ico" viewBox="0 0 64 64" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M10 24 32 12l22 12v26H10V24zm0 0 22 12 22-12M32 36v26M10 50l22 12 22-12"
      />
    </svg>
  )
}

function ActivePulseIcon() {
  return (
    <span className="profile-status-pulse" aria-hidden>
      <span className="profile-status-pulse-ring" />
      <span className="profile-status-pulse-dot" />
    </span>
  )
}

function PriceTagIcon() {
  return (
    <svg className="profile-status-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M3.6 12.2 12.1 3.7a1.4 1.4 0 0 1 1-.4H20a1.2 1.2 0 0 1 1.2 1.2v6.9a1.4 1.4 0 0 1-.4 1L12.3 20a1.4 1.4 0 0 1-2 0L3.6 14.2a1.4 1.4 0 0 1 0-2z"
      />
      <circle cx="16.4" cy="7.6" r="1.35" fill="currentColor" />
    </svg>
  )
}

/**
 * Profile tab — continuous scroll matching thrft-profile-1…4 mockups.
 * Mock data / UI-only actions.
 */
const SPACE_MODES = [
  { id: 'store', label: 'Store' },
  { id: 'closet', label: 'Closet' },
  { id: 'market', label: 'Market' },
  { id: 'stylst', label: 'Stylst' },
]

export default function ProfileScreen({
  userProfile,
  account,
  onSaveProfile,
  onPostListing,
  onListingsChanged,
  onAddProduct,
  onOpenAccountPage,
  onOpenAccount,
  onOpenProduct,
  onSignOut,
}) {
  const [closetSplit, setClosetSplit] = useState(false)
  const [followSheet, setFollowSheet] = useState(null)
  const mediaOwner = account?.username || userProfile?.username || account?.id || ''
  const [media, setMedia] = useState(() => readProfileMedia(mediaOwner))
  const [captions, setCaptions] = useState(() => readCaptions(mediaOwner))
  const [viewPhoto, setViewPhoto] = useState(null)
  const postInputRef = useRef(null)
  const [profileView, setProfileView] = useState('closet')
  const [composeOpen, setComposeOpen] = useState(false)
  const [draftPhoto, setDraftPhoto] = useState('')
  const [draftCaption, setDraftCaption] = useState('')
  const [posting, setPosting] = useState(false)
  useEffect(() => {
    // Double-tapping the shuriken adds a photo while the photos grid is showing.
    if (profileView === 'closet') return undefined
    const add = (e) => {
      e.detail.handled = true
      setComposeOpen(true)
    }
    window.addEventListener('thrft:stylst-add', add)
    return () => window.removeEventListener('thrft:stylst-add', add)
  }, [profileView])
  useEffect(() => { setMedia(readProfileMedia(mediaOwner)); setCaptions(readCaptions(mediaOwner)) }, [mediaOwner])
  const [closetPeople, setClosetPeople] = useState(null)
  const [closetPickOpen, setClosetPickOpen] = useState(false)
  const [closetPickQuery, setClosetPickQuery] = useState('')

  function readChatList() {
    try {
      const list = JSON.parse(localStorage.getItem('thrft-chats-v1') || '[]')
      return Array.isArray(list) ? list.filter((c) => c && c.id) : []
    } catch {
      return []
    }
  }

  function sendClosetToChat(chatId) {
    if (!closetSelected) return
    const item = closetSelected
    const title = item.title || `${item.brand} ${item.category}`.trim() || 'Item'
    const msg = {
      id: `m-${Date.now()}`,
      kind: item.imageUrl ? 'image' : 'text',
      text: title,
      from: 'me',
      at: Date.now(),
      ...(item.imageUrl ? { imageUrl: item.imageUrl, fileName: title } : {}),
    }
    try {
      const next = readChatList().map((c) =>
        c.id === chatId
          ? { ...c, messages: [...(c.messages || []), msg], preview: title, time: 'Now' }
          : c,
      )
      localStorage.setItem('thrft-chats-v1', JSON.stringify(next))
    } catch {
      setClosetPostError('Could not send')
      return
    }
    setClosetPeople(null)
    setClosetPickOpen(false)
    setClosetSplit(false)
    setClosetSelected(null)
  }
  const [spaceTab, setSpaceTab] = useState('closet') // 'store' | 'market' | 'closet' | 'stylst'
  const [panelListingTab, setPanelListingTab] = useState('active')
  const [storeProducts, setStoreProducts] = useState([])
  const [marketListings, setMarketListings] = useState([])
  const [storeProductsError, setStoreProductsError] = useState('')
  const [marketListingsError, setMarketListingsError] = useState('')
  const [listingAction, setListingAction] = useState('')
  const [listingActionError, setListingActionError] = useState('')
  const [closetItems, setClosetItems] = useState([])
  const [closetBrand, setClosetBrand] = useState('All')
  const [closetGlobe, setClosetGlobe] = useState(null)
  const [closetGlobePhase, setClosetGlobePhase] = useState('closed')
  const [closetGlobeQuery, setClosetGlobeQuery] = useState('')
  const [closetType, setClosetType] = useState('All')
  const [closetCustomCategories, setClosetCustomCategories] = useState(() =>
    getCustomCategories(),
  )
  const [closetSelected, setClosetSelected] = useState(null)
  const [closetLookupOpen, setClosetLookupOpen] = useState(false)
  const [closetPosting, setClosetPosting] = useState(false)
  const [closetPostError, setClosetPostError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsClosing, setSettingsClosing] = useState(false)
  const [settingsPeek, setSettingsPeek] = useState(false)
  const [settingsInstant, setSettingsInstant] = useState(false)
  const closeSettings = () => {
    setSettingsClosing(true)
    setTimeout(() => {
      setSettingsOpen(false)
      setSettingsClosing(false)
    }, 280)
  }
  const [shipOpen, setShipOpen] = useState(false)
  const [musicSheet, setMusicSheet] = useState(null) // 'spotify' | 'apple'
  const [musicDraft, setMusicDraft] = useState('')
  const [musicLinks, setMusicLinks] = useState({ spotify: null, apple: null })
  const [atOpen, setAtOpen] = useState(false)
  const [editorPage, setEditorPage] = useState('Profile')
  const [linksSheetOpen, setLinksSheetOpen] = useState(false)
  const [socialDraft, setSocialDraft] = useState('')
  const [activeSocial, setActiveSocial] = useState(null)
  const [socialHandles, setSocialHandles] = useState(() => ({
    ...EMPTY_SOCIAL_HANDLES,
    ...(userProfile?.socialHandles || {}),
  }))
  const [supplierSheetOpen, setSupplierSheetOpen] = useState(false)
  const [supplierDraft, setSupplierDraft] = useState({
    name: '',
    website: '',
    contact: '',
  })
  const [suppliers, setSuppliers] = useState(() =>
    Array.isArray(userProfile?.suppliers) ? userProfile.suppliers : [],
  )
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false)
  useEffect(() => {
    if (!photoSheetOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPhotoSheetOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photoSheetOpen])
  const [nameSheetOpen, setNameSheetOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [accountEmailDraft, setAccountEmailDraft] = useState('')
  const [accountNameDraft, setAccountNameDraft] = useState('')
  const [accountUsernameDraft, setAccountUsernameDraft] = useState('')
  const [accountPasswordDraft, setAccountPasswordDraft] = useState('')
  const [accountEditNote, setAccountEditNote] = useState('')
  const [accountEditBusy, setAccountEditBusy] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [pointsAction, setPointsAction] = useState(null) // 'donate' | 'cashout' | null
  const [pointsAmount, setPointsAmount] = useState('')
  const [moneyOpen, setMoneyOpen] = useState(false)
  const [moneyTab, setMoneyTab] = useState('sales') // points | wallet | sales
  const [salesStats, setSalesStats] = useState({
    active: null,
    sold: null,
    gross: null,
    net: null,
  })
  const [salesError, setSalesError] = useState('')
  const [connectBusy, setConnectBusy] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(() => userProfile?.avatarUrl || '')
  const connections = userProfile?.connections || {
    shopify: { connected: false },
    stripe: { connected: false },
    bank: { connected: false },
  }
  const musicInputRef = useRef(null)
  const pointsAmountRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [stageEl, setStageEl] = useState(null)

  function openPointsAction(action) {
    setPointsAction(action)
    setPointsAmount('')
  }

  function openMoney(tab = 'sales') {
    setMoneyTab(tab)
    setPointsAction(null)
    setPointsAmount('')
    setMoneyOpen(true)
  }

  async function handleConnect(provider, action = 'connect') {
    if (connectBusy) return
    setConnectBusy(provider)
    try {
      if (action === 'connect') {
        // Real credentials required — no fake demo shops/accounts.
        window.alert(
          provider === 'shopify'
            ? 'Connect Shopify from your shop OAuth flow (shop domain required).'
            : provider === 'stripe'
              ? 'Connect Stripe with a real account id from Stripe Connect.'
              : 'Connect a bank with real account details from your payout provider.',
        )
        return
      }
      const result = await connectProvider(provider, action)
      if (result?.profile) await onSaveProfile?.(result.profile)
      else if (result?.connections) {
        await onSaveProfile?.({ connections: result.connections })
      }
    } catch (err) {
      window.alert(err?.message || 'Could not update connection')
    } finally {
      setConnectBusy('')
    }
  }

  function selectMoneyTab(tab) {
    setMoneyTab(tab)
    setPointsAction(null)
    setPointsAmount('')
  }

  useEffect(() => {
    if (!moneyOpen || moneyTab !== 'points' || !pointsAction) return undefined
    const id = requestAnimationFrame(() => pointsAmountRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [moneyOpen, moneyTab, pointsAction])

  useEffect(() => {
    if (!moneyOpen || moneyTab !== 'sales') return undefined
    let alive = true
    if (!isSupabaseConfigured()) {
      setSalesError('Supabase not configured')
      setSalesStats({ active: 0, sold: 0, gross: 0, net: 0 })
      return undefined
    }
    setSalesError('')
    const sellerId =
      account?.id && String(account.id).includes('-') ? account.id : undefined
    fetchSellerSalesStats(sellerId)
      .then((stats) => {
        if (!alive) return
        setSalesStats(stats)
      })
      .catch((err) => {
        if (!alive) return
        setSalesError(String(err?.message || 'Could not load sales'))
        setSalesStats({ active: 0, sold: 0, gross: 0, net: 0 })
      })
    return () => {
      alive = false
    }
  }, [moneyOpen, moneyTab, account?.id])

  useEffect(() => {
    if (userProfile?.socialHandles && typeof userProfile.socialHandles === 'object') {
      setSocialHandles({ ...EMPTY_SOCIAL_HANDLES, ...userProfile.socialHandles })
    }
    if (Array.isArray(userProfile?.suppliers)) setSuppliers(userProfile.suppliers)
    if (typeof userProfile?.avatarUrl === 'string') setAvatarUrl(userProfile.avatarUrl)
  }, [userProfile])

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
  }, [])

  useEffect(() => {
    let alive = true
    fetchMyProducts({ segment: 'store' })
      .then((items) => {
        if (alive) {
          setStoreProducts(Array.isArray(items) ? items : [])
          setStoreProductsError('')
        }
      })
      .catch((error) => {
        if (alive) {
          setStoreProducts([])
          setStoreProductsError(`Could not load Store products: ${error.message || 'Please try again.'}`)
        }
      })
    return () => {
      alive = false
    }
  }, [spaceTab, userProfile?.accountId, account?.id])

  useEffect(() => {
    if (spaceTab !== 'market' || !isSupabaseConfigured()) {
      if (spaceTab === 'market') setMarketListings([])
      return undefined
    }
    let alive = true
    fetchMyListings()
      .then((items) => {
        if (alive) {
          setMarketListings(items)
          setMarketListingsError('')
        }
      })
      .catch((error) => {
        if (alive) {
          setMarketListings([])
          setMarketListingsError(`Could not load Market listings: ${error.message || 'Please try again.'}`)
        }
      })
    return () => {
      alive = false
    }
  }, [spaceTab, userProfile?.accountId, account?.id])

  useEffect(() => {
    if (spaceTab !== 'closet') return
    setClosetItems(fetchClosetItems())
    setClosetSelected(null)
    setClosetSplit(false)
    setClosetPostError('')
    setClosetCustomCategories(getCustomCategories())
  }, [spaceTab])

  const closetBrandItems = useMemo(
    () => [
      { id: 'All', label: 'All' },
      ...LISTING_BRANDS.map((name) => ({ id: name, label: name })),
    ],
    [],
  )

  const closetTypeItems = useMemo(() => {
    const seen = new Set()
    const list = [{ id: 'All', label: 'All' }]
    for (const name of [...LISTING_CATEGORIES, ...closetCustomCategories]) {
      const key = String(name || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      list.push({ id: name, label: name })
    }
    return list
  }, [closetCustomCategories])

  function openClosetGlobe(kind) {
    setClosetGlobeQuery('')
    setClosetGlobe(kind)
    setClosetGlobePhase('enter')
    window.requestAnimationFrame(() => setClosetGlobePhase('open'))
  }

  const closetGlobeItems = useMemo(() => {
    const all = closetGlobe === 'type' ? closetTypeItems : closetBrandItems
    const q = closetGlobeQuery.trim().toLowerCase()
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all
  }, [closetGlobe, closetGlobeQuery, closetBrandItems, closetTypeItems])

  const visibleClosetItems = useMemo(
    () =>
      filterClosetItems(closetItems, {
        brand: closetBrand,
        category: closetType,
      }).filter((item) => item.imageUrl),
    [closetItems, closetBrand, closetType],
  )

  function deleteClosetItem() {
    if (!closetSelected || closetPosting) return
    const title = closetSelected.title || `${closetSelected.brand} ${closetSelected.category}`.trim() || 'this item'
    if (!window.confirm(`Delete ${title} from your Closet?`)) return
    setClosetPostError('')
    try {
      setClosetItems(removeClosetItem(closetSelected.id))
      setClosetSelected(null)
      setClosetSplit(false)
      setClosetPeople(null)
      setClosetPickOpen(false)
    } catch (error) {
      setClosetPostError(String(error?.message || 'Could not delete this item.'))
    }
  }

  async function postClosetToMarket() {
    if (!closetSelected || closetPosting) return
    if (!isSupabaseConfigured()) {
      setClosetPostError('Connect Supabase to post to Market.')
      return
    }

    const price = String(closetSelected.price ?? '').trim() ||
      window.prompt('Enter a price for this item:', '')
    if (price == null) return
    if (!isValidListingPrice(price)) {
      setClosetPostError('Enter a valid price before posting.')
      return
    }
    setClosetPosting(true)
    setClosetPostError('')
    try {
      const imageUrl = await uploadProductPhoto(closetSelected.imageUrl)
      await createListing({
        title: closetSelected.title || `${closetSelected.brand} ${closetSelected.category}`,
        brand: closetSelected.brand || '',
        category: closetSelected.category || '',
        price,
        condition: 'Good',
        description: 'From my Closet',
        imageUrl,
      })
      const next = removeClosetItem(closetSelected.id)
      setClosetItems(next)
      setClosetSelected(null)
      onPostListing?.()
    } catch (err) {
      setClosetPostError(String(err?.message || 'Could not post to Market'))
    } finally {
      setClosetPosting(false)
    }
  }

  async function changeOwnedListing(product, space, file) {
    if (listingAction) return
    if (!file && !window.confirm(`Remove "${product.title}" from ${space === 'store' ? 'Store' : 'Market'}?`)) return
    setListingAction(product.id)
    setListingActionError('')
    try {
      const photoUrl = file ? await uploadCreatorArtwork(file) : ''
      const updated = space === 'store'
        ? await updateListingProduct(product.id, file ? { photoUrl } : { status: 'archived' })
        : await updateMyListing(product.id, file ? { imageUrl: photoUrl } : { status: 'removed' })
      const setProducts = space === 'store' ? setStoreProducts : setMarketListings
      setProducts((items) => items.map((item) => item.id === product.id ? updated : item))
      onListingsChanged?.()
    } catch (error) {
      setListingActionError(error.message || 'Could not update this listing.')
    } finally {
      setListingAction('')
    }
  }

  const musicPreview = useMemo(() => {
    if (!musicSheet || !musicDraft.trim()) return null
    return parseMusicLink(musicSheet, musicDraft)
  }, [musicSheet, musicDraft])

  function openMusic(service) {
    setActiveSocial(null)
    setSocialDraft('')
    setMusicSheet(service)
    setMusicDraft(musicLinks[service]?.url || '')
  }

  function saveMusic() {
    const parsed = parseMusicLink(musicSheet, musicDraft)
    if (!parsed) return
    setMusicLinks((prev) => ({ ...prev, [musicSheet]: parsed }))
    setMusicSheet(null)
    setMusicDraft('')
  }

  function switchSpace(which) {
    if (which === spaceTab) return
    setPanelListingTab('active')
    setSpaceTab(which)
  }

  // Freeze home-scroll so opening overlays never jumps the page;
  // hide underlay for @/ship/Settings so stage atmosphere shows through.
  useEffect(() => {
    const scroller = document.querySelector('.home-scroll')
    const stage = document.querySelector('.stage')
    if (!scroller) return undefined
    const overlayOpen = Boolean(
      atOpen ||
        musicSheet ||
        settingsOpen ||
        shipOpen ||
        linksSheetOpen ||
        supplierSheetOpen ||
        photoSheetOpen ||
        nameSheetOpen ||
        moneyOpen,
    )
    const atmosphereOverlay = Boolean(
      atOpen || settingsOpen || shipOpen || moneyOpen,
    )
    if (stage) {
      stage.classList.toggle('is-overlay-open', atmosphereOverlay)
    }
    if (!overlayOpen) {
      return () => {
        stage?.classList.remove('is-overlay-open')
      }
    }

    const prevTop = scroller.scrollTop
    const prevOverflow = scroller.style.overflow
    scroller.style.overflow = 'hidden'
    scroller.scrollTop = prevTop

    const keep = () => {
      if (scroller.scrollTop !== prevTop) scroller.scrollTop = prevTop
    }
    scroller.addEventListener('scroll', keep, { passive: true })
    const id = requestAnimationFrame(keep)

    return () => {
      cancelAnimationFrame(id)
      scroller.removeEventListener('scroll', keep)
      scroller.style.overflow = prevOverflow
      scroller.scrollTop = prevTop
      stage?.classList.remove('is-overlay-open')
    }
  }, [
    atOpen,
    musicSheet,
    settingsOpen,
    shipOpen,
    linksSheetOpen,
    supplierSheetOpen,
    photoSheetOpen,
    nameSheetOpen,
    moneyOpen,
  ])

  function openNameSheet() {
    setNameDraft(
      userProfile?.displayName ||
        userProfile?.email?.split('@')[0] ||
        '',
    )
    setUsernameDraft(
      String(account?.username || userProfile?.username || '').replace(/^@+/, ''),
    )
    setNameSheetOpen(true)
  }

  async function saveNameSheet() {
    if (nameSaving) return
    const displayName = nameDraft.trim()
    const username = usernameDraft
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
    if (!displayName && !username) return
    setNameSaving(true)
    try {
      if (await usernameTaken(username)) {
        window.alert('That username is taken')
        return
      }
      await onSaveProfile?.({
        ...(displayName ? { displayName } : {}),
        ...(username ? { username } : {}),
      })
      setNameSheetOpen(false)
    } catch (error) {
      window.alert(error?.message || 'Could not save your name')
    } finally {
      setNameSaving(false)
    }
  }

  function closeComposer() {
    setComposeOpen(false)
    setDraftPhoto('')
    setDraftCaption('')
  }

  async function onMediaPicked(file) {
    if (!file || !file.type?.startsWith('image/')) return
    try {
      setDraftPhoto(await compressImage(file, 1080, true))
    } catch (error) {
      window.alert(error?.message || 'Could not read that photo')
    }
  }

  async function submitPost() {
    if (!draftPhoto || posting) return
    setPosting(true)
    try {
      const url = await storeImage(draftPhoto)
      const photos = [url, ...media.photos]
      writeProfileMedia(mediaOwner, 'photos', photos)
      const caption = draftCaption.trim()
      if (caption) {
        writeCaption(mediaOwner, url, caption)
        setCaptions((c) => ({ ...c, [url]: caption }))
      }
      setMedia((m) => ({ ...m, photos }))
      closeComposer()
    } catch (error) {
      window.alert(error?.message || 'Could not save your photo')
    } finally {
      setPosting(false)
    }
  }

  function removePhoto(url) {
    const photos = media.photos.filter((p) => p !== url)
    writeProfileMedia(mediaOwner, 'photos', photos)
    setMedia((m) => ({ ...m, photos }))
    setViewPhoto(null)
  }

  async function onPhotoPicked(file) {
    if (!file || !file.type?.startsWith('image/')) return
    try {
      const dataUrl = await compressImageFile(file)
      await onSaveProfile?.({ avatarUrl: dataUrl })
      setAvatarUrl(dataUrl)
      setPhotoSheetOpen(false)
    } catch (error) {
      window.alert(error?.message || 'Could not save your photo')
    }
  }

  function openProfileEditor(page = 'Profile') {
    setEditorPage(page)
    setAccountEmailDraft(account?.email || userProfile?.email || '')
    setAccountUsernameDraft(
      String(account?.username || userProfile?.username || '').replace(/^@+/, ''),
    )
    setAccountNameDraft(String(userProfile?.displayName || account?.displayName || ''))
    setAccountPasswordDraft('')
    setAccountEditNote('')
    setMusicSheet(null)
    setMusicDraft('')
    setActiveSocial(null)
    setSocialDraft('')
    setAtOpen(true)
  }

  async function usernameTaken(username) {
    const saved = String(account?.username || userProfile?.username || '').toLowerCase()
    if (!username || username === saved || !isSupabaseConfigured()) return false
    const found = await fetchAccountPage(username).catch(() => null)
    return Boolean(found?.account && !found.account.isSelf)
  }

  async function saveAccountEdit() {
    if (accountEditBusy) return
    const savedEmail = String(account?.email || userProfile?.email || '').trim()
    const email = accountEmailDraft.trim() || savedEmail
    const emailChanged = email !== savedEmail
    const username = accountUsernameDraft
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
    const nextPassword = accountPasswordDraft.trim()
    if (!username) {
      setAccountEditNote('Enter a username')
      return
    }
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAccountEditNote('Enter a valid email address')
      return
    }
    if (nextPassword && nextPassword.length < 6) {
      setAccountEditNote('Password needs at least 6 characters')
      return
    }
    setAccountEditBusy(true)
    setAccountEditNote('')
    try {
      if (await usernameTaken(username)) {
        setAccountEditNote('That username is taken')
        return
      }
      if (nextPassword || emailChanged) {
        const supabase = getSupabase()
        if (!supabase) {
          setAccountEditNote('Sign in to change your email or password')
          return
        }
        const { error } = await supabase.auth.updateUser({
          ...(emailChanged ? { email } : {}),
          ...(nextPassword ? { password: nextPassword } : {}),
        })
        if (error) {
          setAccountEditNote(error.message || 'Could not update email or password')
          return
        }
        setAccountPasswordDraft('')
      }
      const displayName = accountNameDraft.trim()
      await onSaveProfile?.({ username, ...(displayName ? { displayName } : {}) })
      setAccountEditNote('')
      closeLinks()
    } catch (err) {
      setAccountEditNote(err?.message || 'Could not save')
    } finally {
      setAccountEditBusy(false)
    }
  }

  function closeLinks() {
    setAtOpen(false)
    setMusicSheet(null)
    setMusicDraft('')
    setActiveSocial(null)
    setSocialDraft('')
    setLinksSheetOpen(false)
  }

  function openSocial(id) {
    setMusicSheet(null)
    setMusicDraft('')
    setActiveSocial(id)
    setSocialDraft(socialHandles[id] || '')
  }

  async function saveSocialHandle() {
    if (!activeSocial) return
    const handle = socialDraft.trim().replace(/^@+/, '')
    const next = { ...socialHandles, [activeSocial]: handle }
    setSocialHandles(next)
    await onSaveProfile?.({ socialHandles: next })
    setLinksSheetOpen(false)
    setActiveSocial(null)
    setSocialDraft('')
  }

  async function saveSupplier() {
    const name = supplierDraft.name.trim()
    if (!name) return
    const next = [
      {
        id: `sup-${Date.now()}`,
        name,
        website: supplierDraft.website.trim(),
        contact: supplierDraft.contact.trim(),
      },
      ...suppliers,
    ].slice(0, 24)
    setSuppliers(next)
    await onSaveProfile?.({ suppliers: next })
    setSupplierDraft({ name: '', website: '', contact: '' })
    setSupplierSheetOpen(false)
  }

  // Focus music input without scrolling the page into view
  useEffect(() => {
    if (!musicSheet) return undefined
    const id = requestAnimationFrame(() => {
      musicInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [musicSheet])

  const settingsSwipe = useRef(null)

  // Dragging the profile left slides the page aside like a glass card, revealing Settings underneath
  const peekTimer = useRef(null)
  const peekTravel = () => Math.min(window.innerWidth * 0.8, 340)
  const setPeek = (p) => stageEl?.style.setProperty('--settings-p', String(p))
  const endPeek = () => {
    stageEl?.classList.remove('is-settings-peek', 'is-settings-dragging', 'is-settings-committing')
    stageEl?.style.removeProperty('--settings-p')
    setSettingsPeek(false)
  }
  const commitPeek = () => {
    stageEl?.classList.remove('is-settings-dragging')
    stageEl?.classList.add('is-settings-committing')
    clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => {
      setSettingsInstant(true)
      setSettingsOpen(true)
      endPeek()
    }, 260)
  }
  const cancelPeek = () => {
    stageEl?.classList.remove('is-settings-dragging')
    setPeek(0)
    clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(endPeek, 280)
  }
  useEffect(() => () => clearTimeout(peekTimer.current), [])

  async function shareProfile() {
    const handle = account?.username || userProfile?.username
    const url = handle ? `${window.location.origin}/@${handle}` : window.location.origin
    try {
      if (navigator.share) await navigator.share({ title: 'Thrft', url })
      else {
        await navigator.clipboard.writeText(url)
        window.alert('Profile link copied')
      }
    } catch {
      // share sheet dismissed
    }
  }

  function holdScroll(e) {
    // Avoid browser scrolling the focused control into view
    e.preventDefault()
  }

  return (
    <div className="profile-screen" role="region" aria-label="Profile">
      <button
        type="button"
        className="profile-menu-btn is-bare"
        aria-label="Settings"
        onMouseDown={holdScroll}
        onClick={() => { setSettingsInstant(false); setSettingsOpen(true) }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <button
        type="button"
        className="profile-menu-btn profile-top-btn is-share is-bare"
        aria-label="Share profile"
        onMouseDown={holdScroll}
        onClick={shareProfile}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
      </button>
      <section
        className="profile-identity"
        aria-label="Account"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0)) {
            settingsSwipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false }
          }
        }}
        onPointerMove={(e) => {
          const st = settingsSwipe.current
          if (!st || !e.isPrimary || e.pointerType === 'mouse' || !stageEl) return
          const dx = e.clientX - st.x
          const dy = e.clientY - st.y
          if (!st.drag) {
            if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
              settingsSwipe.current = null
              return
            }
            if (dx > -12 || -dx < Math.abs(dy) * 1.5) return
            try { e.currentTarget.setPointerCapture(e.pointerId) } catch { return }
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
            st.drag = true
            clearTimeout(peekTimer.current)
            setSettingsPeek(true)
            stageEl.classList.remove('is-settings-committing')
            stageEl.classList.add('is-settings-peek', 'is-settings-dragging')
          }
          setPeek(Math.min(1, Math.max(0, -dx / peekTravel())))
        }}
        onPointerUp={(e) => {
          const st = settingsSwipe.current
          settingsSwipe.current = null
          if (!st) return
          const dx = e.clientX - st.x
          const dy = e.clientY - st.y
          if (st.drag) {
            const velocity = dx / Math.max(1, performance.now() - st.t)
            if (-dx > peekTravel() * 0.4 || velocity < -0.5) commitPeek()
            else cancelPeek()
            return
          }
          // A deliberate sideways swipe with a mouse opens Settings
          if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            setSettingsInstant(false)
            setSettingsOpen(true)
          }
        }}
        onPointerCancel={() => {
          const st = settingsSwipe.current
          settingsSwipe.current = null
          if (st?.drag) cancelPeek()
        }}
      >
        <div className="pf-x-head">
        <div className="pf-user-avatar-wrap">
          <button
            type="button"
            className={`pf-user-avatar is-bare${avatarUrl ? ' has-photo' : ''}`}
            aria-label="View profile photo"
            onClick={() => setPhotoSheetOpen(true)}
          >
            {avatarUrl ? (
              <img className="pf-user-avatar-img" src={avatarUrl} alt="" />
            ) : (
              initialsFromName(userProfile?.displayName)
            )}
          </button>
          <input
            ref={cameraInputRef}
            className="profile-photo-file"
            type="file"
            accept="image/*"
            capture="environment"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onPhotoPicked(file)
            }}
          />
          <input
            ref={galleryInputRef}
            className="profile-photo-file"
            type="file"
            accept="image/*"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onPhotoPicked(file)
            }}
          />
        </div>
        </div>
        <div className="profile-name-row">
          <p className="profile-display-name">
            {userProfile?.displayName || account?.displayName || 'Member'}
            {userProfile?.identityStatus === 'verified' && (
              <span className="profile-id-badge" title="Identity verified with ID.me">
                ID
              </span>
            )}
          </p>
        </div>
        {(account?.username || userProfile?.username) && (
          <button type="button" className="profile-handle is-bare" onClick={() => onOpenAccountPage?.()}>
            @{account?.username || userProfile?.username}
          </button>
        )}
        {!(account?.username || userProfile?.username) && (
          <button
            type="button"
            className="profile-username-link is-empty"
            onClick={openNameSheet}
          >
            Add username
          </button>
        )}
        <div className="profile-social">
          <button type="button" className="profile-social-cell is-bare" disabled={!userProfile?.username}
            onClick={() => setFollowSheet('following')}>
            <span className="profile-social-n">{Number.isInteger(userProfile?.followingCount) ? userProfile.followingCount : '-'}</span>
            <span className="profile-social-l">Following</span>
          </button>
          <div className="profile-social-rule" aria-hidden />
          <button type="button" className="profile-social-cell is-bare" disabled={!userProfile?.username}
            onClick={() => setFollowSheet('followers')}>
            <span className="profile-social-n">{Number.isInteger(userProfile?.followerCount) ? userProfile.followerCount : '-'}</span>
            <span className="profile-social-l">Followers</span>
          </button>
          <div className="profile-view-toggle">
            <button
              type="button"
              className={`profile-photos-jump is-bare${profileView === 'photos' ? ' is-on' : ''}`}
              aria-label="Photos"
              aria-pressed={profileView === 'photos'}
              onClick={() => setProfileView('photos')}
            >
              <GalleryIcon />
            </button>
            <button
              type="button"
              className={`profile-photos-jump is-bare${profileView === 'closet' ? ' is-on' : ''}`}
              aria-label="Closet, Store and Market"
              aria-pressed={profileView === 'closet'}
              onClick={() => setProfileView('closet')}
            >
              <ShirtIcon />
            </button>
            <button
              type="button"
              className="profile-photos-jump is-bare is-on"
              aria-label="Links"
              onClick={() => openProfileEditor('Links')}
            >
              <LinkIcon />
            </button>
          </div>
        </div>
      </section>

      {followSheet && userProfile?.username && (
        <FollowListSheet username={userProfile.username} type={followSheet}
          onClose={() => setFollowSheet(null)} onOpenAccount={onOpenAccount} />
      )}

      <section className="pf-photos" aria-label="Photos" hidden={profileView !== 'photos'}>
        <input
          ref={postInputRef}
          className="profile-photo-file"
          type="file"
          accept="image/*"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            onMediaPicked(file)
          }}
        />
        {media.photos.length === 0 && (
          <div className="pf-photos-empty">
            <p>Share photos</p>
            <button type="button" className="pf-photos-empty-btn is-bare" onClick={() => setComposeOpen(true)}>Add your first photo</button>
          </div>
        )}
        <div className="pf-photos-grid">
          {media.photos.map((url, i) => (
            <button key={url.slice(-40) + i} type="button" className="pf-photo-tile is-bare" aria-label="View photo" onClick={() => setViewPhoto(url)}>
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </section>
      {composeOpen && (
        <div className="pf-compose" role="dialog" aria-label="New photo">
          <div className="pf-compose-top">
            <button type="button" className="pf-compose-back is-bare" aria-label="Back" onClick={closeComposer}>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button type="button" className="pf-compose-post is-bare" disabled={!draftPhoto || posting} onClick={submitPost}>Post</button>
          </div>
          <button type="button" className="pf-compose-square is-bare" aria-label={draftPhoto ? 'Change photo' : 'Choose a photo'} onClick={() => postInputRef.current?.click()}>
            {draftPhoto
              ? <img src={draftPhoto} alt="" />
              : <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          </button>
          <textarea
            className="pf-compose-caption"
            placeholder="Write a caption…"
            maxLength={500}
            rows={4}
            value={draftCaption}
            onChange={(e) => setDraftCaption(e.target.value)}
          />
        </div>
      )}
      {viewPhoto && (
        <div className="profile-photo-view" role="dialog" aria-label="Photo" onClick={() => setViewPhoto(null)}>
          <div className="pf-post" onClick={(e) => e.stopPropagation()}>
            <div className="pf-post-head">
              <span className="pf-post-name">{account?.username || userProfile?.username || userProfile?.displayName || 'Me'}</span>
            </div>
            <img className="pf-photo-full" src={viewPhoto} alt="" />
            {captions[viewPhoto] ? <p className="pf-post-caption">{captions[viewPhoto]}</p> : null}
          </div>
          <button type="button" className="pf-photo-delete is-bare" onClick={(e) => { e.stopPropagation(); removePhoto(viewPhoto) }}>
            Delete
          </button>
        </div>
      )}

      <section className="profile-block profile-spaces-inline" aria-label="Store, Closet and Market" hidden={profileView !== 'closet'}>
        <SectionSwiper
          sections={SPACE_MODES}
          value={spaceTab}
          onChange={switchSpace}
          label="Closet, Store, Market and Stylst"
          onHold={spaceTab === 'stylst' ? undefined : onAddProduct}
          idPrefix="profile-space"
          className="profile-spaces-inline-body"
        >
          {spaceTab !== 'closet' && spaceTab !== 'stylst' && (
            <div
              className="profile-listing-tabs is-panel"
              role="tablist"
              aria-label="Listing status"
            >
              <button
                type="button"
                role="tab"
                aria-label="Active"
                title="Active"
                aria-selected={panelListingTab === 'active'}
                className={`profile-listing-tab is-icon ${panelListingTab === 'active' ? 'is-active' : ''}`}
                onClick={() => setPanelListingTab('active')}
              >
                <ActivePulseIcon />
              </button>
              <button
                type="button"
                role="tab"
                aria-label="Sold"
                title="Sold"
                aria-selected={panelListingTab === 'sold'}
                className={`profile-listing-tab is-icon ${panelListingTab === 'sold' ? 'is-active' : ''}`}
                onClick={() => setPanelListingTab('sold')}
              >
                <PriceTagIcon />
              </button>
            </div>
          )}
          {spaceTab === 'stylst' ? (
            <StylstBoard onOpenProduct={onOpenProduct} />
          ) : spaceTab !== 'closet' ? (
            (() => {
              const rows = spaceTab === 'store'
                ? storeProducts.filter((p) => p.status === panelListingTab)
                : marketListings.filter((p) =>
                    panelListingTab === 'sold' ? p.status === 'sold' : p.status === 'available',
                  )
              const listingError = spaceTab === 'store' ? storeProductsError : marketListingsError
              if (listingError) return <p role="alert">{listingError}</p>
              if (!rows.length) {
                return (
                  <div className="pf-empty-state">
                    <EmptyBoxIcon />
                  </div>
                )
              }
              return (
                <>
                {listingActionError && <p role="alert">{listingActionError}</p>}
                <ul className="profile-product-list">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="profile-product-row is-bare"
                        onClick={() =>
                          onOpenProduct?.({
                            ...p,
                            detailVariant: spaceTab === 'market' ? 'market' : 'store',
                            id: p.id,
                            title: p.title,
                            price: p.price,
                            brand: p.brand,
                            category: p.category,
                            condition: p.condition,
                            description: p.description,
                          })
                        }
                      >
                        <span className="profile-product-photo">
                            <ProductPhoto
                              src={p.photoUrl || p.image_url || p.photo_url || p.mockup_urls?.[0]}
                              cutout={hasProductCutout(p)}
                              alt={p.title}
                              loading="lazy"
                              draggable="false"
                            />
                        </span>
                        <span className="profile-product-name">{p.title}</span>
                        <span className="profile-product-price">{p.price || '—'}</span>
                      </button>
                      <div className="profile-product-actions">
                        <label className="profile-product-action">
                          Replace photo
                          <input type="file" accept="image/png,image/jpeg" disabled={Boolean(listingAction)}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ''
                              if (file) changeOwnedListing(p, spaceTab, file)
                            }} />
                        </label>
                        <button type="button" className="profile-product-action is-bare"
                          disabled={Boolean(listingAction)} onClick={() => changeOwnedListing(p, spaceTab)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                </>
              )
            })()
          ) : (
            <div className="closet-browse">
              <header className="closet-page-head">
                <button
                  type="button"
                  className="closet-page-btn is-bare"
                  aria-label="Add to closet by product number"
                  onClick={() => setClosetLookupOpen(true)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </header>
              {closetLookupOpen && <ClosetNumberLookup
                brands={[...new Set([...LISTING_BRANDS, ...getCustomBrands()])]}
                onClose={() => setClosetLookupOpen(false)}
                onAdded={() => {
                  setClosetLookupOpen(false)
                  setClosetItems(fetchClosetItems())
                }}
              />}
              <div
                className="closet-browse-wheels"
                data-no-section-swipe
                role="group"
                aria-label="Browse closet by brand and type"
              >
                <div className="closet-browse-wheel">
                  <p className="closet-browse-label">Brand</p>
                  <OrbitCarousel
                    variant="wheel"
                    compact
                    className="closet-orbit"
                    items={closetBrandItems}
                    activeId={closetBrand}
                    onSelect={setClosetBrand}
                    onActivate={() => openClosetGlobe('brand')}
                    ariaLabel="Closet brand"
                    prevLabel="Previous brand"
                    nextLabel="Next brand"
                  />
                </div>
                <div className="closet-browse-wheel">
                  <p className="closet-browse-label">Type</p>
                  <OrbitCarousel
                    variant="wheel"
                    compact
                    className="closet-orbit"
                    items={closetTypeItems}
                    activeId={closetType}
                    onSelect={setClosetType}
                    onActivate={() => openClosetGlobe('type')}
                    ariaLabel="Closet type"
                    prevLabel="Previous type"
                    nextLabel="Next type"
                  />
                </div>
              </div>

              {visibleClosetItems.length === 0 ? (
                <div className="pf-empty-state">
                  <EmptyBoxIcon />
                </div>
              ) : (
                <ul className="closet-grid">
                  {visibleClosetItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="closet-tile is-bare"
                        onClick={() => {
                          setClosetSelected(item)
                          setClosetSplit(false)
                          setClosetPeople(null)
                          setClosetPostError('')
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            className="closet-tile-img"
                            src={item.imageUrl}
                            alt=""
                          />
                        ) : (
                          <span className="closet-tile-fallback" aria-hidden />
                        )}
                        <span className="closet-tile-meta">
                          <span className="closet-tile-brand">
                            {item.brand || '—'}
                          </span>
                          <span className="closet-tile-type">
                            {item.category || '—'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {closetSelected && stageEl && createPortal(
                <div
                  className="closet-detail"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Closet item"
                >
                  <button
                    type="button"
                    className="closet-detail-scrim"
                    aria-label="Close"
                    onClick={() => setClosetSelected(null)}
                  />
                  <div className="closet-detail-card">
                    <button
                      type="button"
                      className="closet-detail-x is-bare"
                      aria-label="Close"
                      onClick={() => setClosetSelected(null)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          d="M6 6l12 12M18 6 6 18"
                        />
                      </svg>
                    </button>
                    {closetSelected.imageUrl ? (
                      <img
                        className="closet-detail-img"
                        src={closetSelected.imageUrl}
                        alt=""
                      />
                    ) : null}
                    <div className="closet-detail-info">
                    <p className="closet-detail-title">
                      {closetSelected.title ||
                        `${closetSelected.brand} ${closetSelected.category}`}
                    </p>
                    <p className="closet-detail-sub">
                      {[closetSelected.brand, closetSelected.category]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {closetPostError ? (
                      <p className="closet-detail-error" role="alert">
                        {closetPostError}
                      </p>
                    ) : null}
                    {closetPeople ? (
                      <ul className="closet-people">
                        {closetPeople.length === 0 ? (
                          <li className="closet-people-empty">No chats yet</li>
                        ) : (
                          closetPeople.map((c) => (
                            <li key={c.id} className="closet-pick-row">
                              <button
                                type="button"
                                className="closet-people-btn is-bare"
                                onClick={() => {
                                  setClosetPickQuery('')
                                  setClosetPickOpen(true)
                                }}
                              >
                                {c.title || 'Chat'}
                              </button>
                              <button
                                type="button"
                                className="closet-pick-send is-bare"
                                aria-label={`Send to ${c.title || 'chat'}`}
                                onClick={() => sendClosetToChat(c.id)}
                              >
                                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                                  <path
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 19V5M6 11l6-6 6 6"
                                  />
                                </svg>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                    <div className={`closet-split${closetSplit ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="closet-split-btn is-bare is-market"
                        aria-label="Post to Market"
                        tabIndex={closetSplit ? 0 : -1}
                        disabled={closetPosting}
                        onClick={postClosetToMarket}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="closet-split-plus is-bare"
                        aria-label={closetSplit ? 'Close' : 'Share'}
                        onClick={() => {
                          setClosetSplit((v) => !v)
                          setClosetPeople(null)
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            d="M12 5v14M5 12h14"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="closet-split-btn is-bare is-message"
                        aria-label="Send to a person"
                        tabIndex={closetSplit ? 0 : -1}
                        onClick={() => setClosetPeople((v) => (v ? null : readChatList()))}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            d="M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5"
                          />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="closet-detail-delete is-bare"
                      aria-label="Delete item"
                      disabled={closetPosting}
                      onClick={deleteClosetItem}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"
                        />
                      </svg>
                    </button>
                    </div>
                  </div>
                  {closetPickOpen ? (
                    <div className="closet-pick" role="dialog" aria-label="Send to">
                      <button
                        type="button"
                        className="closet-detail-x is-bare"
                        aria-label="Close"
                        onClick={() => setClosetPickOpen(false)}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            d="M6 6l12 12M18 6 6 18"
                          />
                        </svg>
                      </button>
                      <ul className="closet-pick-list">
                        {readChatList()
                          .filter((c) =>
                            (c.title || '')
                              .toLowerCase()
                              .includes(closetPickQuery.trim().toLowerCase()),
                          )
                          .map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="closet-people-btn is-bare"
                                onClick={() => sendClosetToChat(c.id)}
                              >
                                {c.title || 'Chat'}
                              </button>
                            </li>
                          ))}
                      </ul>
                      <input
                        className="closet-pick-search"
                        type="search"
                        placeholder="Search"
                        value={closetPickQuery}
                        onChange={(e) => setClosetPickQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  ) : null}
                </div>,
                stageEl,
              )}
            </div>
          )}
        </SectionSwiper>
      </section>

      {stageEl &&
        moneyOpen &&
        createPortal(
          <div className="profile-links-layer">
            <button
              type="button"
              className="profile-links-scrim"
              aria-label="Dismiss"
              onClick={() => setMoneyOpen(false)}
            />
          <div
            className="profile-panel profile-money-panel profile-money-card"
            role="dialog"
            aria-modal="true"
            aria-label="Money"
          >
            <header className="profile-panel-top">
              <button
                type="button"
                className="profile-panel-back"
                aria-label="Back to profile"
                onClick={() => setMoneyOpen(false)}
              >
                <BackIcon />
              </button>
              <h2 className="profile-suppliers-title">Money</h2>
              <span className="profile-panel-spacer" aria-hidden />
            </header>
            <div className="profile-panel-body profile-money-body">
              <div className="profile-money-grid" role="group" aria-label="Money">
                <button
                  type="button"
                  className={`profile-money-tile is-bank${connections.bank?.connected ? ' is-active' : ''}`}
                  aria-label={
                    connections.bank?.connected ? 'Disconnect bank' : 'Connect bank'
                  }
                  disabled={connectBusy === 'bank'}
                  onClick={() =>
                    handleConnect(
                      'bank',
                      connections.bank?.connected ? 'disconnect' : 'connect',
                    )
                  }
                >
                  <MoneyIcon className="profile-money-tile-ico" />
                </button>
                {MONEY_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={moneyTab === id}
                    className={`profile-money-tile${moneyTab === id ? ' is-active' : ''}`}
                    onClick={() => selectMoneyTab(id)}
                  >
                    {id === 'wallet' ? (
                      <WalletIcon className="profile-money-tile-ico" />
                    ) : id === 'points' ? (
                      <span className="profile-money-tile-ico is-sparkle">
                        <SparkleIcon />
                      </span>
                    ) : (
                      <Icon />
                    )}
                    <span className="profile-money-tile-label">{label}</span>
                  </button>
                ))}
              </div>

              <div className="profile-money-detail">
                {moneyTab === 'points' && (
                  <section className="profile-money-section is-points" aria-label="Points">
                    <div className="profile-credits-card is-half">
                      <div className="profile-credits-row">
                        <SparkleIcon />
                        <span className="profile-credits-n">-</span>
                      </div>
                    </div>
                    <div className="profile-points-actions">
                      {pointsAction === 'donate' ? (
                        <label className="profile-points-amount">
                          <span className="profile-points-amount-ico" aria-hidden>
                            <DonateHandHeartIcon />
                          </span>
                          <input
                            ref={pointsAmountRef}
                            className="profile-points-amount-input"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            aria-label="Points to donate"
                            value={pointsAmount}
                            onChange={(e) =>
                              setPointsAmount(e.target.value.replace(/[^\d]/g, ''))
                            }
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          className="glass-cta is-minimal is-icon"
                          aria-label="Donate"
                          onClick={() => openPointsAction('donate')}
                        >
                          <DonateHandHeartIcon />
                        </button>
                      )}
                      {pointsAction === 'cashout' ? (
                        <label className="profile-points-amount">
                          <span className="profile-points-amount-ico" aria-hidden>
                            <CashOutAtmIcon />
                          </span>
                          <input
                            ref={pointsAmountRef}
                            className="profile-points-amount-input"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            aria-label="Points to cash out"
                            value={pointsAmount}
                            onChange={(e) =>
                              setPointsAmount(e.target.value.replace(/[^\d]/g, ''))
                            }
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          className="glass-cta is-minimal is-icon"
                          aria-label="Cash out"
                          onClick={() => openPointsAction('cashout')}
                        >
                          <CashOutAtmIcon />
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {moneyTab === 'wallet' && (
                  <section className="profile-money-section" aria-label="Wallet">
                    <div className="profile-credits-card is-half">
                      <div className="profile-credits-row">
                        <WalletIcon />
                        <span className="profile-credits-n">-</span>
                      </div>
                    </div>
                  </section>
                )}

                {moneyTab === 'sales' && (
                  <section className="profile-money-section" aria-label="Sales">
                    <div className="profile-sales-grid">
                      {[
                        [
                          salesStats.gross == null
                            ? '…'
                            : formatListingPrice(salesStats.gross),
                          'Gross',
                        ],
                        [
                          salesStats.net == null
                            ? '…'
                            : formatListingPrice(salesStats.net),
                          'Net',
                        ],
                        [
                          salesStats.sold == null ? '…' : String(salesStats.sold),
                          'Sold',
                        ],
                        [
                          salesStats.active == null
                            ? '…'
                            : String(salesStats.active),
                          'Active',
                        ],
                      ].map(([value, label]) => (
                        <div key={label} className="profile-stat-card">
                          <span className="profile-stat-value">{value}</span>
                          <span className="profile-stat-label">{label}</span>
                        </div>
                      ))}
                    </div>
                    {salesError ? (
                      <p className="profile-sales-note" role="status">
                        {salesError}
                      </p>
                    ) : null}
                  </section>
                )}
              </div>
            </div>

            <div className="profile-money-bottom-dock">
              <button
                type="button"
                className="profile-money-dock-back"
                aria-label="Back to profile"
                onClick={() => setMoneyOpen(false)}
              >
                <BackIcon />
              </button>
            </div>
          </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        atOpen &&
        createPortal(
          <div className="profile-links-layer is-edit">
            <button
              type="button"
              className="profile-links-scrim"
              aria-label="Dismiss"
              onClick={closeLinks}
            />
          <div
            className="profile-panel profile-links-card profile-edit-card"
            role="dialog"
            aria-modal="true"
            aria-label={editorPage === 'Profile' ? 'Edit profile' : editorPage}
          >
            <header className="profile-panel-top">
              <button
                type="button"
                className="profile-panel-back"
                aria-label="Back"
                onClick={closeLinks}
              >
                <BackIcon />
              </button>
              {editorPage !== 'Money' ? (
                <h2 className="profile-suppliers-title">{editorPage}</h2>
              ) : (
                <span className="profile-panel-spacer" aria-hidden />
              )}
              <span className="profile-panel-spacer" aria-hidden />
            </header>
            <div className="profile-panel-body profile-at-body">
              {editorPage === 'Profile' && <section className="profile-block is-panel-section" aria-labelledby="account-edit-label">
                <h2 id="account-edit-label" className="profile-label">
                  Account
                </h2>
                <label className="profile-name-field">
                  <span className="profile-name-field-mark" aria-hidden>
                    <PersonIcon />
                  </span>
                  <input
                    value={accountNameDraft}
                    aria-label="Name"
                    placeholder="Name"
                    autoComplete="name"
                    onChange={(e) => setAccountNameDraft(e.target.value)}
                  />
                </label>
                <label className="profile-name-field">
                  <span className="profile-name-field-mark" aria-hidden>
                    <PersonIcon />
                  </span>
                  <input
                    value={accountUsernameDraft}
                    aria-label="Username"
                    placeholder="Username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setAccountUsernameDraft(e.target.value.replace(/^@+/, ''))}
                  />
                </label>
                <label className="profile-name-field">
                  <span className="profile-name-field-mark" aria-hidden>
                    @
                  </span>
                  <input
                    type="email"
                    value={accountEmailDraft}
                    aria-label="Email"
                    placeholder="Email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) =>
                      setAccountEmailDraft(e.target.value)
                    }
                  />
                </label>
                <label className="profile-name-field">
                  <span className="profile-name-field-mark" aria-hidden>
                    <LockIcon />
                  </span>
                  <input
                    type="password"
                    value={accountPasswordDraft}
                    aria-label="Password"
                    autoComplete="new-password"
                    placeholder="New password"
                    onChange={(e) => setAccountPasswordDraft(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="profile-music-save"
                  disabled={accountEditBusy}
                  onClick={saveAccountEdit}
                >
                  Save
                </button>
                {accountEditNote ? (
                  <p className="profile-sales-note" role="status">
                    {accountEditNote}
                  </p>
                ) : null}
              </section>

              }
              {editorPage === 'Links' && <>
              <section className="profile-block is-panel-section" aria-labelledby="links-label">
                <h2 id="links-label" className="profile-label">
                  Media
                </h2>
                <div className="profile-music-row">
                  <button
                    type="button"
                    className={`profile-music-btn is-spotify${musicLinks.spotify ? ' has-link' : ''}${musicSheet === 'spotify' ? ' is-on' : ''}`}
                    aria-label="Spotify"
                    aria-pressed={musicSheet === 'spotify'}
                    onMouseDown={holdScroll}
                    onClick={() => openMusic('spotify')}
                  >
                    <SpotifyIcon />
                  </button>
                  <button
                    type="button"
                    className={`profile-music-btn is-apple${musicLinks.apple ? ' has-link' : ''}${musicSheet === 'apple' ? ' is-on' : ''}`}
                    aria-label="Apple Music"
                    aria-pressed={musicSheet === 'apple'}
                    onMouseDown={holdScroll}
                    onClick={() => openMusic('apple')}
                  >
                    <AppleMusicIcon />
                  </button>
                </div>
                {musicSheet ? (
                  <div className="profile-link-editor">
                    <label className="profile-social-handle-field">
                      <span className={`profile-link-platform-icon is-${musicSheet}`} aria-hidden>
                        {musicSheet === 'spotify' ? <SpotifyIcon /> : <AppleMusicIcon />}
                      </span>
                      <input
                        ref={musicInputRef}
                        className="profile-music-input"
                        type="url"
                        placeholder="URL"
                        aria-label="Music link"
                        value={musicDraft}
                        onChange={(e) => setMusicDraft(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="profile-music-save"
                      disabled={!musicPreview}
                      onClick={saveMusic}
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="profile-block is-panel-section" aria-label="Social media">
                <div className="profile-social-row" role="group" aria-label="Media handles">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const filled = Boolean(socialHandles[platform.id])
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        className={`profile-social-btn is-${platform.id}${filled ? ' has-handle' : ''}`}
                        aria-pressed={activeSocial === platform.id}
                        aria-label={
                          filled
                            ? `${platform.label} @${socialHandles[platform.id]}`
                            : `${platform.label} handle`
                        }
                        title={platform.label}
                        onMouseDown={holdScroll}
                        onClick={() => openSocial(platform.id)}
                      >
                        {socialIcon(platform.id)}
                      </button>
                    )
                  })}
                </div>
                {activeSocial ? (
                  <div className="profile-link-editor">
                <label className="profile-social-handle-field">
                  <span className="profile-link-platform-icon" aria-hidden>
                    {socialIcon(activeSocial)}
                  </span>
                  <input
                    className="glass-input is-handle"
                    value={socialDraft}
                    placeholder="username"
                    aria-label="Username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setSocialDraft(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="profile-music-save"
                  onClick={saveSocialHandle}
                >
                  Save
                </button>
                  </div>
                ) : null}
              </section>

              </>}
              {editorPage === 'Money' && <section className="profile-block is-panel-section" aria-label="Money">
                <div className="profile-money-grid" role="group" aria-label="Money">
                  <button
                    type="button"
                    className={`profile-money-tile is-bank${connections.bank?.connected ? ' is-active' : ''}`}
                    aria-label={
                      connections.bank?.connected ? 'Disconnect bank' : 'Connect bank'
                    }
                    disabled={connectBusy === 'bank'}
                    onClick={() =>
                      handleConnect(
                        'bank',
                        connections.bank?.connected ? 'disconnect' : 'connect',
                      )
                    }
                  >
                    <MoneyIcon className="profile-money-tile-ico" />
                  </button>
                  {MONEY_TABS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={moneyTab === id}
                      className={`profile-money-tile${moneyTab === id ? ' is-active' : ''}`}
                      onClick={() => selectMoneyTab(id)}
                    >
                      {id === 'wallet' ? (
                        <WalletIcon className="profile-money-tile-ico" />
                      ) : id === 'points' ? (
                        <span className="profile-money-tile-ico is-sparkle">
                          <SparkleIcon />
                        </span>
                      ) : (
                        <Icon />
                      )}
                      <span className="profile-money-tile-label">{label}</span>
                    </button>
                  ))}
                </div>
                <div className="profile-money-detail">
                  {moneyTab === 'points' && (
                    <section className="profile-money-section is-points" aria-label="Points">
                      <div className="profile-credits-card is-half">
                        <div className="profile-credits-row">
                          <SparkleIcon />
                          <span className="profile-credits-n">-</span>
                        </div>
                      </div>
                    </section>
                  )}
                  {moneyTab === 'wallet' && (
                    <section className="profile-money-section" aria-label="Wallet">
                      <div className="profile-credits-card is-half">
                        <div className="profile-credits-row">
                          <WalletIcon />
                          <span className="profile-credits-n">-</span>
                        </div>
                      </div>
                    </section>
                  )}
                  {moneyTab === 'sales' && (
                    <section className="profile-money-section" aria-label="Sales">
                      <div className="profile-sales-grid">
                        {[
                          [
                            salesStats.gross == null
                              ? '…'
                              : formatListingPrice(salesStats.gross),
                            'Gross',
                          ],
                          [
                            salesStats.net == null
                              ? '…'
                              : formatListingPrice(salesStats.net),
                            'Net',
                          ],
                          [
                            salesStats.sold == null ? '…' : String(salesStats.sold),
                            'Sold',
                          ],
                          [
                            salesStats.active == null
                              ? '…'
                              : String(salesStats.active),
                            'Active',
                          ],
                        ].map(([value, label]) => (
                          <div key={label} className="profile-stat-card">
                            <span className="profile-stat-value">{value}</span>
                            <span className="profile-stat-label">{label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
                <GiveBack />
              </section>
              }
              
            </div>
          </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        musicSheet &&
        !atOpen &&
        createPortal(
          <div className="profile-music-sheet" role="dialog" aria-modal="true">
            <button
              type="button"
              className="profile-music-scrim"
              aria-label="Dismiss"
              onClick={() => {
                setMusicSheet(null)
                setMusicDraft('')
              }}
            />
            <div className="profile-music-card">
              <div className="profile-music-card-head">
                <h2
                  className="profile-music-card-title is-icon"
                  aria-label={musicSheet === 'spotify' ? 'Spotify' : 'Apple Music'}
                >
                  {musicSheet === 'spotify' ? (
                    <SpotifyIcon className="profile-music-brand-ico is-title is-spotify" />
                  ) : (
                    <AppleMusicIcon className="profile-music-brand-ico is-title is-apple" />
                  )}
                </h2>
                <button
                  type="button"
                  className="profile-music-close"
                  aria-label="Close"
                  onClick={() => {
                    setMusicSheet(null)
                    setMusicDraft('')
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="profile-music-field">
                <input
                  ref={musicInputRef}
                  className="profile-music-input"
                  type="url"
                  placeholder="URL"
                  aria-label="Music link"
                  value={musicDraft}
                  onChange={(e) => setMusicDraft(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="profile-music-save"
                disabled={!musicPreview}
                onClick={saveMusic}
              >
                Save
              </button>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        closetGlobePhase !== 'closed' &&
        closetGlobe &&
        createPortal(
          <BrandGlobe
            variant="dock"
            phase={closetGlobePhase === 'enter' ? 'enter' : closetGlobePhase === 'exit' ? 'exit' : 'open'}
            brands={closetGlobeItems}
            activeId={closetGlobe === 'type' ? closetType : closetBrand}
            title={closetGlobe === 'type' ? 'Category' : 'Brands'}
            snug={closetGlobe === 'type'}
            searchValue={closetGlobeQuery}
            onSearchChange={setClosetGlobeQuery}
            searchPlaceholder=""
            onSelect={(id) => {
              if (closetGlobe === 'type') setClosetType(id)
              else setClosetBrand(id)
              setClosetGlobePhase('exit')
            }}
            onClose={() => setClosetGlobePhase('exit')}
            onExitComplete={() => {
              setClosetGlobe(null)
              setClosetGlobePhase('closed')
              setClosetGlobeQuery('')
            }}
          />,
          stageEl,
        )}

      {stageEl && settingsPeek && stageEl.querySelector('.app-column') &&
        createPortal(
          <div className="atmosphere settings-peek-atmosphere" aria-hidden>
            <AtmosphereFlow />
          </div>,
          stageEl.querySelector('.app-column'),
        )}

      {stageEl &&
        (settingsOpen || settingsPeek) &&
        createPortal(
          <SwipeBackPage className={`settings-slide${settingsOpen ? '' : ' is-peeking'}${settingsInstant ? ' is-instant' : ''}${settingsClosing ? ' is-closing' : ''}`} onDismiss={() => { setSettingsOpen(false); setSettingsClosing(false) }}>
          <div className="atmosphere" aria-hidden>
            <AtmosphereFlow />
          </div>
          <SettingsScreen
            onBack={closeSettings}
            userProfile={userProfile}
            onSaveProfile={onSaveProfile}
            onSignOut={onSignOut}
            onEditProfile={() => openProfileEditor('Profile')}
            onEditLinks={() => openProfileEditor('Links')}
            onEditMoney={() => openProfileEditor('Money')}
            onOpenOrders={() => setShipOpen(true)}
          />
          </SwipeBackPage>,
          stageEl,
        )}

      {stageEl &&
        shipOpen &&
        createPortal(
          <OrdersScreen onBack={() => setShipOpen(false)} />,
          stageEl,
        )}

      {stageEl &&
        linksSheetOpen &&
        activeSocial &&
        createPortal(
          <div
            className="glass-sheet is-neat"
            role="dialog"
            aria-modal="true"
            aria-label={`${SOCIAL_PLATFORMS.find((p) => p.id === activeSocial)?.label || 'Media'} handle`}
          >
            <button
              type="button"
              className="glass-sheet-scrim"
              aria-label="Dismiss"
              onClick={() => {
                setLinksSheetOpen(false)
                setActiveSocial(null)
              }}
            />
            <div className="glass-sheet-card">
              <div className="glass-sheet-head profile-photo-sheet-head">
                <span className="profile-social-sheet-icon" aria-hidden>
                  {socialIcon(activeSocial)}
                </span>
                <button
                  type="button"
                  className="glass-overlay-icon-btn"
                  aria-label="Close"
                  onClick={() => {
                    setLinksSheetOpen(false)
                    setActiveSocial(null)
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
              <label className="glass-field">
                <div className="profile-social-handle-field">
                  <span className="profile-link-platform-icon" aria-hidden>
                    {socialIcon(activeSocial)}
                  </span>
                  <input
                    className="glass-input is-handle"
                    value={socialDraft}
                    placeholder={
                      SOCIAL_PLATFORMS.find((p) => p.id === activeSocial)?.placeholder ||
                      'username'
                    }
                    aria-label="Username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setSocialDraft(e.target.value)}
                  />
                </div>
              </label>
              <button type="button" className="glass-cta" onClick={saveSocialHandle}>
                Save
              </button>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        supplierSheetOpen &&
        createPortal(
          <div className="glass-sheet" role="dialog" aria-modal="true" aria-label="Add connection">
            <button
              type="button"
              className="glass-sheet-scrim"
              aria-label="Dismiss"
              onClick={() => setSupplierSheetOpen(false)}
            />
            <div className="glass-sheet-card">
              <div className="glass-sheet-head profile-photo-sheet-head">
                <button
                  type="button"
                  className="glass-overlay-icon-btn"
                  aria-label="Close"
                  onClick={() => setSupplierSheetOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <label className="glass-field">
                <span className="glass-field-label">Name</span>
                <input
                  className="glass-input"
                  value={supplierDraft.name}
                  placeholder=""
                  onChange={(e) => setSupplierDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="glass-field">
                <span className="glass-field-label">Website</span>
                <input
                  className="glass-input"
                  value={supplierDraft.website}
                  placeholder=""
                  onChange={(e) => setSupplierDraft((d) => ({ ...d, website: e.target.value }))}
                />
              </label>
              <label className="glass-field">
                <span className="glass-field-label">Contact</span>
                <input
                  className="glass-input"
                  value={supplierDraft.contact}
                  placeholder=""
                  onChange={(e) => setSupplierDraft((d) => ({ ...d, contact: e.target.value }))}
                />
              </label>
              <button type="button" className="glass-cta" onClick={saveSupplier}>
                Save
              </button>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        nameSheetOpen &&
        createPortal(
          <div
            className="glass-sheet profile-name-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Edit name and username"
          >
            <button
              type="button"
              className="glass-sheet-scrim"
              aria-label="Dismiss"
              onClick={() => setNameSheetOpen(false)}
            />
            <div className="glass-sheet-card">
              <div className="glass-sheet-head">
                <h2 className="glass-sheet-title">Profile</h2>
                <button
                  type="button"
                  className="glass-overlay-icon-btn"
                  aria-label="Close"
                  onClick={() => setNameSheetOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <label className="profile-name-field">
                <span className="profile-name-field-mark" aria-hidden>
                  <PersonIcon />
                </span>
                <input
                  value={nameDraft}
                  aria-label="Name"
                  placeholder=""
                  autoCapitalize="words"
                  autoCorrect="off"
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </label>
              <label className="profile-name-field">
                <span className="profile-name-field-mark" aria-hidden>
                  @
                </span>
                <input
                  value={usernameDraft}
                  aria-label="Username"
                  placeholder=""
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) =>
                    setUsernameDraft(e.target.value.replace(/^@+/, ''))
                  }
                />
              </label>
              <button
                type="button"
                className="glass-cta"
                disabled={nameSaving || (!nameDraft.trim() && !usernameDraft.trim())}
                onClick={saveNameSheet}
              >
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        photoSheetOpen &&
        createPortal(
          <div
            className="profile-photo-view"
            role="dialog"
            aria-modal="true"
            aria-label="Profile photo"
            onClick={(event) => {
              if (event.target === event.currentTarget) setPhotoSheetOpen(false)
            }}
          >
            <div className={`profile-photo-view-avatar${avatarUrl ? ' has-photo' : ''}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile photo" />
              ) : (
                initialsFromName(userProfile?.displayName)
              )}
            </div>
            <button
              type="button"
              className="profile-photo-view-cam is-bare"
              aria-label="Change profile photo"
              onClick={() => galleryInputRef.current?.click()}
            >
              <CameraBadge />
            </button>
          </div>,
          stageEl,
        )}
    </div>
  )
}
