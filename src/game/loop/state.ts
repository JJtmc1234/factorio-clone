import type { BuildSelection, Building, Direction } from '../buildings'

export const state = {
  selectedBuild: null as BuildSelection,
  openedBuilding: null as Building | null,
  buildDirection: 'right' as Direction,
}

export function rotateDirection(direction: Direction): Direction {
  if (direction === 'up') return 'right'
  if (direction === 'right') return 'down'
  if (direction === 'down') return 'left'
  return 'up'
}
