/**
 * Fixed-size profile node.
 * Empty ring when `avatarUrl` is null; filled circle when a real profile is wired.
 */
export default function Bubble({ profile, rank, x, y, weaving, scale = 1 }) {
  const filled = Boolean(profile.avatarUrl)
  const s = Number.isFinite(scale) ? scale : 1

  return (
    <div
      className={`bubble-slot ${weaving ? 'is-weaving' : ''}`}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) scale(${s})`,
        // Climber (scaled up mid-pass) glosses over the neighbor in the zig-zag
        zIndex: weaving ? (s > 1.01 ? 8 : 5) : 1,
      }}
      data-rank={rank}
      title={`${profile.label} · $${profile.profit.toLocaleString()} · #${rank}`}
    >
      <div className="bubble-body">
        {filled ? (
          <img
            className="profile-avatar"
            src={profile.avatarUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <div className="profile-empty" aria-hidden />
        )}
      </div>
    </div>
  )
}
