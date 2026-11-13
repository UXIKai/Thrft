export function stepNavigationSpring(value, velocity, target, elapsed) {
  const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)))
  const dt = elapsed / steps
  for (let i = 0; i < steps; i += 1) {
    // Damping at 21.1 gives an exact ~5% overshoot past the target
    velocity += ((260 * (target - value) - 21.1 * velocity) / 0.9) * dt
    value += velocity * dt
  }
  return { value, velocity }
}
