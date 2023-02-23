import { DefaultTheme } from 'styled-components'

export type SupportedColor = 'red' | 'green' | 'neutral'

export function getColoredTrackPercentages(
  min: number,
  max: number,
  entry: number,
  exit: number
): [number, number] {
  const d = max - min
  const start = (Math.min(entry, exit) - min) / d
  const end = (max - Math.max(entry, exit)) / d
  return [Math.round(start * 100), Math.round(end * 100)]
}

export function trackColorToThemeColor(trackColor: SupportedColor, theme: DefaultTheme): string {
  if (trackColor === 'green') return theme.colors.profit
  if (trackColor === 'red') return theme.colors.loss
  return theme.colors.subtitle
}
