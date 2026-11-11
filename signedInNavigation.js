/** Keep in-app back navigation on Home without changing authentication. */
export function guardSignedInNavigation(target, onHome) {
  const { history, location } = target
  const url = `${location.pathname}${location.search}${location.hash}`
  const homeState = { ...history.state, thrftNavigation: 'home' }
  history.replaceState(homeState, '', url)
  history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)

  const onBack = () => {
    onHome()
    history.replaceState(homeState, '', url)
    history.pushState({ ...homeState, thrftNavigation: 'app' }, '', url)
  }
  target.addEventListener('popstate', onBack)
  return () => target.removeEventListener('popstate', onBack)
}
