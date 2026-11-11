/** Keep signed-in browser gestures from leaving the current app page. */
export function guardSignedInNavigation(target) {
  const { history, location } = target
  const url = `${location.pathname}${location.search}${location.hash}`
  const homeState = { ...history.state, thrftNavigation: 'home' }
  history.replaceState(homeState, '', url)
  history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)

  const onBack = () => {
    history.replaceState(homeState, '', url)
    history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)
  }
  let blockingSwipe = false
  const onTouchStart = (event) => {
    blockingSwipe = false
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    const width = target.visualViewport?.width || target.innerWidth
    if (touch.clientX > 40 && touch.clientX < width - 40) return
    blockingSwipe = true
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
  target.addEventListener('touchstart', onTouchStart, { passive: false, capture: true })
  target.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
  target.addEventListener('touchend', onTouchEnd, true)
  target.addEventListener('touchcancel', onTouchEnd, true)
  return () => {
    target.removeEventListener('popstate', onBack)
    target.removeEventListener('touchstart', onTouchStart, true)
    target.removeEventListener('touchmove', onTouchMove, true)
    target.removeEventListener('touchend', onTouchEnd, true)
    target.removeEventListener('touchcancel', onTouchEnd, true)
  }
}
