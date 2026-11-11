/** Ignore browser toolbar/gesture offsets when no text field is being edited. */
export function viewportOffset({ editing, keyboardHeight, offsetTop, keyboardShift }) {
  if (!editing || keyboardHeight <= 120) return 0
  return Math.max(0, Math.round(offsetTop || 0)) - keyboardShift
}
