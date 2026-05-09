import type { Building } from './types'
import { formatItemName } from '../format'

function describeItem(item: string | null) {
  return item ? formatItemName(item) : 'empty'
}

export function getBuildingTooltipLines(building: Building) {
  if (building.type === 'wooden_chest' || building.type === 'iron_chest') {
    const title = building.type === 'iron_chest' ? 'Iron chest' : 'Wooden chest'
    return [
      title,
      `${describeItem(building.item)}: ${building.count}/${building.capacity}`,
      'Click open  X deconstruct',
    ]
  }

  if (building.type === 'transport_belt') {
    return [
      `Belt ${building.direction}`,
      `Items: ${building.items.length}/8`,
      'F take front  X deconstruct',
    ]
  }

  if (building.type === 'stone_furnace') {
    return [
      `Stone furnace  fuel:${building.fuel.toFixed(1)}`,
      `In: ${describeItem(building.inputItem)} ${building.inputCount}/${building.inputCapacity}`,
      `Out: ${describeItem(building.outputItem)} ${building.outputCount}/${building.outputCapacity}`,
    ]
  }

  if (building.type === 'burner_inserter') {
    return [
      `Burner inserter ${building.direction}  fuel:${building.fuel.toFixed(1)}`,
      `Held: ${describeItem(building.heldItem)}  progress:${building.progress.toFixed(2)}`,
      'G take held  X deconstruct',
    ]
  }

  // burner_drill
  const outputText = building.outputItem
    ? `${formatItemName(building.outputItem)} ${building.outputCount}/${building.outputCapacity}`
    : `empty 0/${building.outputCapacity}`

  return [
    `Burner mining drill ${building.direction}  fuel:${building.fuel.toFixed(1)}`,
    `Out: ${outputText}`,
    'Click open  X deconstruct',
  ]
}
