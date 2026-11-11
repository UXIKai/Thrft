/** Keep in-app back navigation on Home without changing authentication. */
export function guardSignedInNavigation(target, onHome) {
  const { history, location } = target
  const url = `${location.pathname}${location.search}${location.hash}`
  const homeState = { ...history.state, thrftNavigation: 'home' }
  history.replaceState(homeState, '', url)
  history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)

  const showHome = () => {
    const document = target.document
    if (document?.startViewTransition && !target.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(onHome)
    } else {
      onHome()
    }
  }
  const onBack = () => {
    showHome()
    history.replaceState(homeState, '', url)
    history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)
  }
  let swipe = null
  const onTouchStart = (event) => {
    swipe = null
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    if (touch.clientX > 20) return
    swipe = { x: touch.clientX, y: touch.clientY }
    if (event.cancelable) event.preventDefault()
  }
  const onTouchMove = (event) => {
    if (!swipe) return
    if (event.touches.length !== 1) {
      swipe = null
      return
    }
    if (event.cancelable) event.preventDefault()
  }
  const onTouchEnd = (event) => {
    if (!swipe) return
    const start = swipe
    swipe = null
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = Math.abs(touch.clientY - start.y)
    if (dx >= 60 && dx > dy * 1.5) showHome()
  }
  const onTouchCancel = () => { swipe = null }
  target.addEventListener('popstate', onBack)
  target.addEventListener('touchstart', onTouchStart, { passive: false })
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  target.addEventListener('touchend', onTouchEnd)
  target.addEventListener('touchcancel', onTouchCancel)
  return () => {
    target.removeEventListener('popstate', onBack)
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchCancel)
  }
}
