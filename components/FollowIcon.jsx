export default function FollowIcon({ following }) {
  return (
    <svg viewBox="0 0 28 24" width="28" height="24" aria-hidden fill="currentColor">
      <circle cx="19" cy="7" r="5" />
      <path d="M10 22c0-5 4-8 9-8s9 3 9 8c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1z" />
      <g className="follow-icon-mark" style={{ opacity: following ? 0 : 1, transform: following ? 'rotate(-90deg) scale(.5)' : 'none' }}>
        <path d="M6 7v8M2 11h8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g className="follow-icon-mark" style={{ opacity: following ? 1 : 0, transform: following ? 'none' : 'rotate(90deg) scale(.5)' }}>
        <path d="M2.5 11l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
