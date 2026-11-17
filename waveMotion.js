const WAVE_POINTS = [120, 610, 440, 620, 720, 490, 1180, 400]
const FLOW_PERIOD_MS = 18000

export function waveFrame(elapsed) {
  const angle = (elapsed % FLOW_PERIOD_MS) / FLOW_PERIOD_MS * Math.PI * 2
  const fold = Math.cos(angle)
  const across = (value) => 450 + (value - 450) * fold
  return {
    fold,
    phase: (1 - fold) / 2,
    points: WAVE_POINTS.map((value, i) => i % 2 === 0
      ? value + Math.sin(value / 1440 * Math.PI * 2) * 48
      : across(value)),
    start: [-180, across(-600)],
    end: [1620, across(1020)],
  }
}
