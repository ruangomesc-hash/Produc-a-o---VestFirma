export const CHART_SLICE_COLORS = [
  '#e8b923',
  '#ffcc4d',
  '#14b8a6',
  '#60a5fa',
  '#f87171',
  '#a78bfa',
  '#4ade80',
  '#fb923c',
  '#f472b6',
  '#94a3b8',
  '#22d3ee',
  '#c084fc',
]

export function corFatia(index: number): string {
  return CHART_SLICE_COLORS[index % CHART_SLICE_COLORS.length]
}
