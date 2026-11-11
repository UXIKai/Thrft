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
  let blockingSwipe = false
  const onTouchStart = (event) => {
    blockingSwipe = false
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    if (touch.clientX > 20 && touch.clientX < target.innerWidth - 20) return
    blockingSwipe = true
    if (event.cancelable) event.preventDefault()
  }
  const onTouchMove = (event) => {
    if (!blockingSwipe) return
    if (event.touches.length !== 1) {
      blockingSwipe = false
      return
    }
    if (event.cancelable) event.preventDefault()
  }
  const onTouchEnd = () => { blockingSwipe = false }
  target.addEventListener('popstate', onBack)
  target.addEventListener('touchstart', onTouchStart, { passive: false })
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  target.addEventListener('touchend', onTouchEnd)
  target.addEventListener('touchcancel', onTouchEnd)
  return () => {
    target.removeEventListener('popstate', onBack)
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchEnd)
  }
}
