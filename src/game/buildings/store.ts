import type { Building, Buildings } from './types'

const buildings: Buildings = []

export function getAllBuildings() {
  return buildings
}

export function addBuilding(building: Building) {
  buildings.push(building)
}
