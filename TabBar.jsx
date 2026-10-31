const TABS = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M12 3.2 3.5 10.2V21h6.2v-6.4h4.6V21h6.2V10.2L12 3.2z"
        />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M4 4.8h16A1.2 1.2 0 0 1 21.2 6v9.2a1.2 1.2 0 0 1-1.2 1.2H9.4L4.8 20.4V16.4H4A1.2 1.2 0 0 1 2.8 15.2V6A1.2 1.2 0 0 1 4 4.8z"
        />
      </svg>
    ),
  },
  {
    id: 'design',
    label: 'Create',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon tab-icon-plus">
        <path
          fill="currentColor"
          d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
        />
      </svg>
    ),
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M12 20.4S3.6 15.1 3.6 9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.4 2.5c0 5.4-8.4 10.7-8.4 10.7z"
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <circle cx="12" cy="8" r="3.4" fill="currentColor" />
        <path
          fill="currentColor"
          d="M5.2 19.6c.6-3.4 3.3-5.2 6.8-5.2s6.2 1.8 6.8 5.2H5.2z"
        />
      </svg>
    ),
  },
]

export default function TabBar({ active = 'home', onChange }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-item ${selected ? 'is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
            aria-label={tab.label}
            onClick={() => onChange?.(tab.id)}
          >
            {tab.icon}
          </button>
        )
      })}
    </nav>
  )
}
