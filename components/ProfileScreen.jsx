import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  connectProvider,
  fetchMyProducts,
  initialsFromName,
} from '../api.js'
import {
  fetchClosetItems,
  filterClosetItems,
  removeClosetItem,
} from '../closet.js'
import { getCustomCategories } from '../customCatalog.js'
import { LISTING_BRANDS, LISTING_CATEGORIES } from '../listingCatalog.js'
import { createListing, fetchSellerSalesStats, formatListingPrice } from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import OrbitCarousel from './OrbitCarousel.jsx'
import SettingsScreen from './SettingsScreen.jsx'
import './GlassOverlay.css'
import './ProfileScreen.css'

function GearIcon() {
  return (
    <svg className="profile-gear-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M19.4 13.2v-2.4l-1.5-.3a5.8 5.8 0 0 0-.5-1.3l.9-1.3-1.7-1.7-1.3.9a5.8 5.8 0 0 0-1.3-.5L13.2 4.6h-2.4l-.3 1.5a5.8 5.8 0 0 0-1.3.5l-1.3-.9-1.7 1.7.9 1.3a5.8 5.8 0 0 0-.5 1.3l-1.5.3v2.4l1.5.3c.12.46.29.9.5 1.3l-.9 1.3 1.7 1.7 1.3-.9c.4.21.84.38 1.3.5l.3 1.5h2.4l.3-1.5c.46-.12.9-.29 1.3-.5l1.3.9 1.7-1.7-.9-1.3c.21-.4.38-.84.5-1.3l1.5-.3z"
      />
    </svg>
  )
}

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

function TakePhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M9 6.2h6l1.1 1.4H18a1.6 1.6 0 0 1 1.6 1.6v8A1.6 1.6 0 0 1 18 18.8H6A1.6 1.6 0 0 1 4.4 17.2v-8A1.6 1.6 0 0 1 6 7.6h1.9L9 6.2z"
      />
      <circle cx="12" cy="13" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect
        x="4.2"
        y="5.2"
        width="15.6"
        height="13.6"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="9" cy="10.2" r="1.5" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5.8 16.4 3.6-3.4 2.4 2.2 3-3.2 3.4 4.4"
      />
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

function MoneyIcon() {
  return (
    <svg className="profile-money-ico" viewBox="0 0 24 24" aria-hidden>
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

function BankIcon() {
  return (
    <svg className="profile-money-tile-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4 10h16v1.4H4V10zm1.2 2.8h2.2V18H5.2v-5.2zm5.7 0h2.2V18h-2.2v-5.2zm5.7 0H19V18h-2.4v-5.2zM3.5 19.2h17v1.3h-17v-1.3zM12 3.4 20.5 8H3.5L12 3.4z"
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
  { id: 'bank', label: 'Bank', Icon: BankIcon },
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

function NamePencilIcon() {
  return (
    <svg className="profile-name-pencil-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M4.5 16.8 15.2 6.1a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.2 20.5H4.5v-3.7z"
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
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.6 14.4 14.4 9.6"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.35 16.65 8.7 18.3a3.3 3.3 0 0 1-4.65-4.65l1.65-1.65"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.65 7.35 15.3 5.7a3.3 3.3 0 0 1 4.65 4.65l-1.65 1.65"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg className="profile-truck-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M3.4 6.2h10.4v8.2H3.4z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M13.8 9.2h3.6l2.8 2.8v2.4h-6.4V9.2z"
      />
      <circle cx="7.2" cy="16.6" r="1.55" fill="none" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="17.2" cy="16.6" r="1.55" fill="none" stroke="currentColor" strokeWidth="1.55" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        d="M8.75 16.6h6.5M3.4 14.4v1.2h1.2M19 14.4h1.4v1.2"
      />
    </svg>
  )
}

/** Storefront — not a house. */
function StorefrontIcon() {
  return (
    <svg className="profile-mode-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M4.4 9.2 5.6 5.4h12.8l1.2 3.8c.15.5-.2 1-.7 1H5.1c-.5 0-.85-.5-.7-1z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M5.2 10.2V19c0 .7.5 1.2 1.2 1.2h11.2c.7 0 1.2-.5 1.2-1.2v-8.8M9.2 20.2v-5.2h5.6v5.2"
      />
    </svg>
  )
}

function ClosetIcon() {
  return (
    <svg className="profile-mode-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M5.2 3.8h13.6A1.4 1.4 0 0 1 20.2 5.2v14.4a1.4 1.4 0 0 1-1.4 1.4H5.2a1.4 1.4 0 0 1-1.4-1.4V5.2A1.4 1.4 0 0 1 5.2 3.8z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M12 3.8v17.2M8.2 11.2h1.6M14.2 11.2h1.6"
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

function ShipMap() {
  return (
    <svg className="profile-ship-map" viewBox="0 0 320 168" aria-hidden>
      <rect width="320" height="168" fill="rgba(255,255,255,0.02)" />
      <path
        fill="rgba(255,255,255,0.1)"
        d="M22 70c14-22 40-34 68-30 22 3 36 18 56 16 14-2 22-16 38-18 24-3 48 10 70 6 18-3 34-16 50-8 12 6 16 22 10 34-8 16-28 20-42 30-18 12-22 32-42 38-24 8-52 0-74-10-16-7-26-22-42-26-20-6-46 4-62-12-10-10-8-24-4-30z"
      />
      <path
        fill="rgba(255,255,255,0.06)"
        d="M48 118c10-6 24-4 34 2 8 5 10 16 4 24-8 10-24 12-36 6-10-5-12-20-2-32zM248 40c16-4 32 6 36 18 3 10-6 20-16 22-14 4-28-4-34-14-5-9 0-22 14-26z"
      />
      <path
        d="M78 96c28-10 58-22 96-28 24-4 48-2 72 8"
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.4"
        strokeDasharray="3.5 4.5"
        strokeLinecap="round"
      />
      <circle cx="78" cy="96" r="3.8" fill="#fff" />
      <circle cx="174" cy="70" r="3.2" fill="#fff" />
      <circle cx="246" cy="76" r="4.6" fill="#fff" />
      <circle
        cx="246"
        cy="76"
        r="8.5"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
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
  { id: 'store', label: 'Store', Icon: StorefrontIcon },
  { id: 'closet', label: 'Closet', Icon: ClosetIcon },
]

export default function ProfileScreen({
  userProfile,
  account,
  onSaveProfile,
  onPostListing,
  onOpenAccountPage,
  onOpenProduct,
  onSignOut,
}) {
  const [spaceTab, setSpaceTab] = useState('store') // 'store' | 'closet'
  const [panelListingTab, setPanelListingTab] = useState('active')
  const [storeProducts, setStoreProducts] = useState([])
  const [closetItems, setClosetItems] = useState([])
  const [closetBrand, setClosetBrand] = useState('All')
  const [closetType, setClosetType] = useState('All')
  const [closetCustomCategories, setClosetCustomCategories] = useState(() =>
    getCustomCategories(),
  )
  const [closetSelected, setClosetSelected] = useState(null)
  const [closetPosting, setClosetPosting] = useState(false)
  const [closetPostError, setClosetPostError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)
  const [musicSheet, setMusicSheet] = useState(null) // 'spotify' | 'apple'
  const [musicDraft, setMusicDraft] = useState('')
  const [musicLinks, setMusicLinks] = useState({ spotify: null, apple: null })
  const [atOpen, setAtOpen] = useState(false)
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
  const [nameSheetOpen, setNameSheetOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [pointsAction, setPointsAction] = useState(null) // 'donate' | 'cashout' | null
  const [pointsAmount, setPointsAmount] = useState('')
  const [moneyOpen, setMoneyOpen] = useState(false)
  const [moneyTab, setMoneyTab] = useState('sales') // bank | points | wallet | sales
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
        if (alive) setStoreProducts(Array.isArray(items) ? items : [])
      })
      .catch(() => {
        if (alive) setStoreProducts([])
      })
    return () => {
      alive = false
    }
  }, [spaceTab, userProfile?.accountId, account?.id])

  useEffect(() => {
    if (spaceTab !== 'closet') return
    setClosetItems(fetchClosetItems())
    setClosetSelected(null)
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

  const visibleClosetItems = useMemo(
    () =>
      filterClosetItems(closetItems, {
        brand: closetBrand,
        category: closetType,
      }),
    [closetItems, closetBrand, closetType],
  )

  async function postClosetToMarket() {
    if (!closetSelected || closetPosting) return
    if (!isSupabaseConfigured()) {
      setClosetPostError('Connect Supabase to post to Market.')
      return
    }
    setClosetPosting(true)
    setClosetPostError('')
    try {
      await createListing({
        title: closetSelected.title || `${closetSelected.brand} ${closetSelected.category}`,
        brand: closetSelected.brand || '',
        category: closetSelected.category || '',
        price: '',
        condition: 'Good',
        description: 'From my Closet',
        imageUrl: closetSelected.imageUrl || 'placeholder',
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

  const musicPreview = useMemo(() => {
    if (!musicSheet || !musicDraft.trim()) return null
    return parseMusicLink(musicSheet, musicDraft)
  }, [musicSheet, musicDraft])

  function openMusic(service) {
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
      .replace(/[^a-z0-9._]/g, '')
    if (!displayName && !username) return
    setNameSaving(true)
    try {
      await onSaveProfile?.({
        ...(displayName ? { displayName } : {}),
        ...(username ? { username } : {}),
      })
      setNameSheetOpen(false)
    } finally {
      setNameSaving(false)
    }
  }

  async function onPhotoPicked(file) {
    if (!file || !file.type?.startsWith('image/')) return
    try {
      const dataUrl = await compressImageFile(file)
      setAvatarUrl(dataUrl)
      setPhotoSheetOpen(false)
      await onSaveProfile?.({ avatarUrl: dataUrl })
    } catch {
      /* ignore bad image */
    }
  }

  function openSocial(id) {
    setActiveSocial(id)
    setSocialDraft(socialHandles[id] || '')
    setLinksSheetOpen(true)
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

  function holdScroll(e) {
    // Avoid browser scrolling the focused control into view
    e.preventDefault()
  }

  return (
    <div className="profile-screen">
      <header className="profile-top">
        <h1 className="profile-title" aria-label="Profile" />
        <button
          type="button"
          className="profile-gear"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon />
        </button>
      </header>

      <section className="profile-identity" aria-label="Account">
        <div className="pf-user-avatar-wrap">
          <div
            className={`pf-user-avatar${avatarUrl ? ' has-photo' : ''}`}
            aria-hidden
          >
            {avatarUrl ? (
              <img className="pf-user-avatar-img" src={avatarUrl} alt="" />
            ) : (
              initialsFromName(userProfile?.displayName)
            )}
          </div>
          <button
            type="button"
            className="profile-cam"
            aria-label="Change photo"
            onClick={() => setPhotoSheetOpen(true)}
          >
            <CameraBadge />
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
        <div className="profile-name-row">
          <p className="profile-name">
            {userProfile?.displayName ||
              userProfile?.email?.split('@')[0] ||
              'Member'}
            {userProfile?.identityStatus === 'verified' && (
              <span className="profile-id-badge" title="Identity verified with ID.me">
                ID
              </span>
            )}
          </p>
          <button
            type="button"
            className="profile-name-edit"
            aria-label="Edit name and username"
            onMouseDown={holdScroll}
            onClick={openNameSheet}
          >
            <NamePencilIcon />
          </button>
        </div>
        {(account?.username || userProfile?.username) ? (
          <button
            type="button"
            className="profile-username-link"
            onClick={() => onOpenAccountPage?.()}
          >
            @{account?.username || userProfile?.username}
          </button>
        ) : (
          <button
            type="button"
            className="profile-username-link is-empty"
            onClick={openNameSheet}
          >
            Add username
          </button>
        )}
        <p className="profile-joined">Joined {userProfile?.joined || 'Oct 22'}</p>
        <div className="profile-social">
          <div className="profile-social-cell">
            <span className="profile-social-n">-</span>
            <span className="profile-social-l">Following</span>
          </div>
          <div className="profile-social-rule" aria-hidden />
          <div className="profile-social-cell">
            <span className="profile-social-n">-</span>
            <span className="profile-social-l">Followers</span>
          </div>
        </div>
      </section>

      <section
        className="profile-block profile-tools-row"
        aria-label="Links, money, and shipping"
      >
        <button
          type="button"
          className="profile-spaces-btn is-compact is-bare"
          aria-label="Open links and music"
          onMouseDown={holdScroll}
          onClick={() => setAtOpen(true)}
        >
          <LinkIcon />
        </button>
        <button
          type="button"
          className="profile-money-btn is-inline"
          aria-label="Open Money"
          onMouseDown={holdScroll}
          onClick={() => openMoney('sales')}
        >
          <MoneyIcon />
        </button>
        <button
          type="button"
          className="profile-suppliers-btn is-compact is-bare"
          aria-label="Open ship tracker"
          onMouseDown={holdScroll}
          onClick={() => setShipOpen(true)}
        >
          <TruckIcon />
        </button>
      </section>

      <section className="profile-block profile-spaces-inline" aria-label="Store and Closet">
        <div
          className="profile-panel-modes is-inline"
          role="tablist"
          aria-label="Store and Closet"
        >
          {SPACE_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={spaceTab === id}
              className={`profile-panel-mode ${spaceTab === id ? 'is-active' : ''}`}
              onMouseDown={holdScroll}
              onClick={() => switchSpace(id)}
            >
              <Icon />
            </button>
          ))}
        </div>

        <div className="profile-spaces-inline-body">
          {spaceTab === 'store' && (
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
          {spaceTab === 'store' ? (
            (() => {
              const rows = storeProducts.filter((p) => p.status === panelListingTab)
              if (!rows.length) {
                return (
                  <div className="pf-empty-state">
                    <EmptyBoxIcon />
                  </div>
                )
              }
              return (
                <ul className="profile-product-list">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="profile-product-row"
                        onClick={() =>
                          onOpenProduct?.({
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
                        <span>{p.title}</span>
                        <span>{p.price || '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()
          ) : (
            <div className="closet-browse">
              <div
                className="closet-browse-wheels"
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
                        className="closet-tile"
                        onClick={() => {
                          setClosetSelected(item)
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

              {closetSelected && (
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
                    {closetSelected.imageUrl ? (
                      <img
                        className="closet-detail-img"
                        src={closetSelected.imageUrl}
                        alt=""
                      />
                    ) : null}
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
                    <button
                      type="button"
                      className="closet-detail-post"
                      disabled={closetPosting}
                      onClick={postClosetToMarket}
                    >
                      {closetPosting ? 'Posting…' : 'Post to Market'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {stageEl &&
        moneyOpen &&
        createPortal(
          <div
            className="profile-panel profile-money-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Money"
          >
            <div className="profile-panel-body profile-money-body">
              <div className="profile-money-grid" role="tablist" aria-label="Money">
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
                {moneyTab === 'bank' && (
                  <section className="profile-money-section" aria-label="Bank">
                    {connections.bank?.connected ? (
                      <>
                        <div className="profile-credits-card is-half">
                          <div className="profile-credits-row">
                            <BankIcon />
                            <span className="profile-credits-n is-bank">
                              {connections.bank.bankName || 'Bank'}
                              {connections.bank.last4
                                ? ` ···${connections.bank.last4}`
                                : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="glass-cta is-minimal"
                          disabled={connectBusy === 'bank'}
                          onClick={() => handleConnect('bank', 'disconnect')}
                        >
                          Disconnect bank
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="glass-cta is-icon"
                        aria-label="Connect bank"
                        disabled={connectBusy === 'bank'}
                        onClick={() => handleConnect('bank', 'connect')}
                      >
                        <span className="profile-bank-link-ico" aria-hidden>
                          🔗
                        </span>
                      </button>
                    )}
                  </section>
                )}

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
          </div>,
          stageEl,
        )}

      {stageEl &&
        atOpen &&
        createPortal(
          <div
            className="profile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Links and music"
          >
            <header className="profile-panel-top">
              <button
                type="button"
                className="profile-panel-back"
                aria-label="Back to profile"
                onClick={() => setAtOpen(false)}
              >
                <BackIcon />
              </button>
              <h2 className="profile-suppliers-title">Links</h2>
              <span className="profile-panel-spacer" aria-hidden />
            </header>
            <div className="profile-panel-body profile-at-body">
              <section className="profile-block is-panel-section" aria-labelledby="music-label">
                <h2 id="music-label" className="profile-label">
                  Music
                </h2>
                <div className="profile-music-row">
                  <button
                    type="button"
                    className={`profile-music-btn is-spotify${musicLinks.spotify ? ' has-link' : ''}`}
                    aria-label="Spotify"
                    onMouseDown={holdScroll}
                    onClick={() => openMusic('spotify')}
                  >
                    <SpotifyIcon />
                  </button>
                  <button
                    type="button"
                    className={`profile-music-btn is-apple${musicLinks.apple ? ' has-link' : ''}`}
                    aria-label="Apple Music"
                    onMouseDown={holdScroll}
                    onClick={() => openMusic('apple')}
                  >
                    <AppleMusicIcon />
                  </button>
                </div>
              </section>

              <section className="profile-block is-panel-section" aria-labelledby="links-label">
                <h2 id="links-label" className="profile-label">
                  Social
                </h2>
                <div className="profile-social-row" role="group" aria-label="Social handles">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const filled = Boolean(socialHandles[platform.id])
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        className={`profile-social-btn is-${platform.id}${filled ? ' has-handle' : ''}`}
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
              </section>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        musicSheet &&
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
        settingsOpen &&
        createPortal(
          <SettingsScreen
            onBack={() => setSettingsOpen(false)}
            userProfile={userProfile}
            onSaveProfile={onSaveProfile}
            onSignOut={onSignOut}
          />,
          stageEl,
        )}

      {stageEl &&
        shipOpen &&
        createPortal(
          <div
            className="profile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Ship Tracker"
          >
            <header className="profile-panel-top">
              <button
                type="button"
                className="profile-panel-back"
                aria-label="Back to profile"
                onClick={() => setShipOpen(false)}
              >
                <BackIcon />
              </button>
              <div className="profile-label-row is-panel-title">
                <h2 className="profile-suppliers-title" id="ship-label">
                  Ship Tracker
                </h2>
                <span className="profile-live">
                  <span className="profile-live-dot" aria-hidden />
                  Live
                </span>
              </div>
              <span className="profile-panel-spacer" aria-hidden />
            </header>
            <div className="profile-panel-body">
              <div className="profile-ship-card">
                <div className="profile-ship-map-wrap">
                  <ShipMap />
                  <div className="profile-ship-chip" aria-hidden>
                    WI
                  </div>
                </div>
                <div className="profile-ship-stats">
                  <div className="profile-ship-stat">
                    <span className="profile-ship-n">-</span>
                    <span className="profile-ship-l">Cities</span>
                  </div>
                  <div className="profile-ship-rule" aria-hidden />
                  <div className="profile-ship-stat">
                    <span className="profile-ship-n">-</span>
                    <span className="profile-ship-l">Regions</span>
                  </div>
                  <div className="profile-ship-rule" aria-hidden />
                  <div className="profile-ship-stat">
                    <span className="profile-ship-n">-</span>
                    <span className="profile-ship-l">Orders</span>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          stageEl,
        )}

      {stageEl &&
        linksSheetOpen &&
        activeSocial &&
        createPortal(
          <div
            className="glass-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${SOCIAL_PLATFORMS.find((p) => p.id === activeSocial)?.label || 'Social'} handle`}
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
                  <span className="profile-social-at" aria-hidden>
                    @
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
              <label className="glass-field">
                <span className="glass-field-label">Name</span>
                <input
                  className="glass-input"
                  value={nameDraft}
                  placeholder="Display name"
                  autoCapitalize="words"
                  autoCorrect="off"
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </label>
              <label className="glass-field">
                <span className="glass-field-label">Username</span>
                <div className="profile-social-handle-field">
                  <span className="profile-social-at" aria-hidden>
                    @
                  </span>
                  <input
                    className="glass-input is-handle"
                    value={usernameDraft}
                    placeholder="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) =>
                      setUsernameDraft(e.target.value.replace(/^@+/, ''))
                    }
                  />
                </div>
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
            className="glass-sheet profile-photo-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Change photo"
          >
            <button
              type="button"
              className="glass-sheet-scrim"
              aria-label="Dismiss"
              onClick={() => setPhotoSheetOpen(false)}
            />
            <div className="glass-sheet-card">
              <div className="glass-sheet-head profile-photo-sheet-head">
                <button
                  type="button"
                  className="glass-overlay-icon-btn"
                  aria-label="Close"
                  onClick={() => setPhotoSheetOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="profile-photo-options">
                <button
                  type="button"
                  className="profile-photo-option"
                  aria-label="Take photo"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <span className="profile-photo-option-ico">
                    <TakePhotoIcon />
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-photo-option"
                  aria-label="Photo gallery"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <span className="profile-photo-option-ico">
                    <GalleryIcon />
                  </span>
                </button>
              </div>
            </div>
          </div>,
          stageEl,
        )}
    </div>
  )
}
