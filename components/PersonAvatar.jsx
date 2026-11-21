import { useEffect, useState } from 'react'
import { fetchAccountPage } from '../api.js'

const cache = new Map()

function lookup(username) {
  if (!cache.has(username)) {
    cache.set(username, fetchAccountPage(username)
      .then((data) => data?.account?.avatarUrl || data?.avatarUrl || '')
      .catch(() => { cache.delete(username); return '' }))
  }
  return cache.get(username)
}

// Initials until the person's profile photo is found, then the photo.
export default function PersonAvatar({ username, initials, className, ...props }) {
  const clean = String(username || '').trim()
  const [photo, setPhoto] = useState('')
  useEffect(() => {
    let active = true
    setPhoto('')
    if (clean) lookup(clean).then((url) => { if (active) setPhoto(url) })
    return () => { active = false }
  }, [clean])
  return (
    <span {...props} className={`${className || ''}${photo ? ' has-avatar-photo' : ''}`.trim()}>
      {photo ? <img className="person-avatar-img" src={photo} alt="" draggable="false" onError={() => setPhoto('')} /> : initials}
    </span>
  )
}
