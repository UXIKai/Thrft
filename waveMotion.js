const FLOW_PERIOD_MS = 18000
const SPIN_PERIOD_MS = 18000
const MID = 450
const AMPLITUDE = 330
const WAVELENGTH = 1440
const START = -180
const CENTER = 720
const END = 1620
const HANDLE = (CENTER - START) / 3

// The S is a helix seen from the side: turning it about the vertical axis slides its phase, so the curve keeps
// its bend and never folds flat.
export function waveFrame(elapsed) {
  const spin = (elapsed % SPIN_PERIOD_MS) / SPIN_PERIOD_MS * Math.PI * 2
  const k = Math.PI * 2 / WAVELENGTH
  const across = (along) => MID + AMPLITUDE * Math.sin(k * along - spin)
  const slope = (along) => AMPLITUDE * k * Math.cos(k * along - spin)
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
