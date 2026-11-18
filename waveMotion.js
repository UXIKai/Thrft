const FLOW_PERIOD_MS = 18000
const SWAY_PERIOD_MS = 26000
// How far the S slides (radians of its phase) and how much its bend breathes while it sways
const SWAY = 0.32
const BREATH = 0.08
const MID = 450
const AMPLITUDE = 330
const WAVELENGTH = 1440
const START = -180
const CENTER = 720
const END = 1620
const HANDLE = (CENTER - START) / 3

// The S holds its shape and only drifts gently, like liquid settling; the light flowing along its edge does the rest.
export function waveFrame(elapsed) {
  const cycle = (elapsed % SWAY_PERIOD_MS) / SWAY_PERIOD_MS * Math.PI * 2
  const spin = SWAY * Math.sin(cycle)
  const amplitude = AMPLITUDE * (1 + BREATH * Math.sin(cycle * 2 + 1))
  const k = Math.PI * 2 / WAVELENGTH
  const across = (along) => MID + amplitude * Math.sin(k * along - spin)
  const slope = (along) => amplitude * k * Math.cos(k * along - spin)
  return {
    fold: 1,
    phase: (elapsed % FLOW_PERIOD_MS) / FLOW_PERIOD_MS,
    spin,
    points: [
      START + HANDLE, across(START) + slope(START) * HANDLE,
      CENTER - HANDLE, across(CENTER) - slope(CENTER) * HANDLE,
      CENTER, across(CENTER),
      END - HANDLE, across(END) - slope(END) * HANDLE,
    ],
    start: [START, across(START)],
    end: [END, across(END)],
  }
}
