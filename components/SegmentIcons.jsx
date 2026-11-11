export function MarketIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 10 10 3.5M17 10l-3-6.5" />
      <path fill="currentColor" fillRule="evenodd" d="M2.5 9h19a1 1 0 0 1 1 1v1.2a1 1 0 0 1-1 1h-.3l-1.6 8.1a1.6 1.6 0 0 1-1.6 1.3H6a1.6 1.6 0 0 1-1.6-1.3l-1.6-8.1h-.3a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Zm5.3 5a.9.9 0 0 0-.9.9v3.4a.9.9 0 0 0 1.8 0v-3.4a.9.9 0 0 0-.9-.9Zm4.2 0a.9.9 0 0 0-.9.9v3.4a.9.9 0 0 0 1.8 0v-3.4a.9.9 0 0 0-.9-.9Zm4.2 0a.9.9 0 0 0-.9.9v3.4a.9.9 0 0 0 1.8 0v-3.4a.9.9 0 0 0-.9-.9Z" />
    </svg>
  )
}

export function StoreIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 17V7h3.5a3 3 0 0 1 0 6H9m3.5 0 3 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function ClosetIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M5 2.5h6.2v17H3.5v-15.5A1.5 1.5 0 0 1 5 2.5Zm4 7.2a.9.9 0 0 0-.9.9v1.8a.9.9 0 0 0 1.8 0v-1.8a.9.9 0 0 0-.9-.9Z" />
      <path fill="currentColor" fillRule="evenodd" d="M12.8 2.5H19a1.5 1.5 0 0 1 1.5 1.5v15.5h-7.7v-17Zm2.2 7.2a.9.9 0 0 0-.9.9v1.8a.9.9 0 0 0 1.8 0v-1.8a.9.9 0 0 0-.9-.9Z" />
      <path fill="currentColor" d="M4.5 20.3h3v1.7h-3Zm12 0h3v1.7h-3Z" />
    </svg>
  )
}
