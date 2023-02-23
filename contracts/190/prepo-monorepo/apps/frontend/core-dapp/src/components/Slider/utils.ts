export function getColoredTrackPercentages(
  min: number,
  max: number,
  entry: number,
  exit: number
): [number, number] {
  const d = max - min
  const start = (Math.min(entry, exit) - min) / d
  const end = (max - Math.max(entry, exit)) / d
  return [Number((start * 100).toFixed(1)), Number((end * 100).toFixed(1))]
}
