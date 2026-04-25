import type { Building } from './types'

export function getBuildingTooltipLines(building: Building) {
  if (building.type === 'wooden_chest') {
    const itemText = building.item ?? 'empty'
    return [
      'wooden chest',
      `${itemText}: ${building.count}/${building.capacity}`,
      'E open  X deconstruct',
    ]
  }

  if (building.type === 'transport_belt') {
    return [
      `belt ${building.direction}`,
      `item: ${building.item ?? 'empty'}`,
      'E open  G take  X deconstruct',
    ]
  }

  if (building.type === 'stone_furnace') {
    return [
      `2x2 furnace fuel:${building.fuel.toFixed(1)}`,
      `in: ${building.inputItem ?? 'empty'} ${building.inputCount}/${building.inputCapacity}`,
      `out: ${building.outputItem ?? 'empty'} ${building.outputCount}/${building.outputCapacity}`,
    ]
  }

  if (building.type === 'burner_inserter') {
    return [
      `burner inserter ${building.direction} fuel:${building.fuel.toFixed(1)}`,
      `held: ${building.heldItem ?? 'empty'}  progress:${building.progress.toFixed(2)}`,
      'F fuel  G take held item  X deconstruct',
    ]
  }

  const outputText = building.outputItem
    ? `${building.outputItem} ${building.outputCount}/${building.outputCapacity}`
    : `empty 0/${building.outputCapacity}`

  return [
    `2x2 drill ${building.direction} fuel:${building.fuel.toFixed(1)}`,
    `out: ${outputText}`,
    'F fuel  E open  X deconstruct',
  ]
}
