import useSwipeBack from './useSwipeBack.js'

export default function SwipeBackPage({ as: Tag = 'div', onDismiss, children, ...props }) {
  const ref = useSwipeBack(onDismiss)
  return <Tag ref={ref} {...props}>{children}</Tag>
}
