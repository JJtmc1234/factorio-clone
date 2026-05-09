import type { Building } from '../../buildings'
import { formatItemName } from '../../format'

function describe(item: string | null) {
  return item ? formatItemName(item) : 'empty'
}

export function drawBuildingPanel(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  building: Building,
) {
  const panelW = 290
  const panelH = 210
  const panelX = canvas.width - panelW - 20
  const panelY = 20

  ctx.fillStyle = 'rgba(20, 20, 20, 0.9)'
  ctx.fillRect(panelX, panelY, panelW, panelH)

  ctx.strokeStyle = '#bdbdbd'
  ctx.lineWidth = 2
  ctx.strokeRect(panelX, panelY, panelW, panelH)

  ctx.fillStyle = 'white'
  ctx.font = '18px sans-serif'

  if (building.type === 'burner_drill') {
    ctx.fillText('Burner mining drill', panelX + 14, panelY + 28)
    const output = building.outputItem
      ? `${formatItemName(building.outputItem)} ×${building.outputCount}`
      : 'empty'
    ctx.font = '14px sans-serif'
    ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
    ctx.fillText(`Output: ${output}`, panelX + 14, panelY + 102)
    ctx.fillText('2×2 footprint', panelX + 14, panelY + 124)
    ctx.fillText('G = take one output item', panelX + 14, panelY + 168)
    return
  }

  if (building.type === 'wooden_chest' || building.type === 'iron_chest') {
    const title = building.type === 'iron_chest' ? 'Iron chest' : 'Wooden chest'
    ctx.fillText(title, panelX + 14, panelY + 28)
    const stored = building.item
      ? `${formatItemName(building.item)} ×${building.count}`
      : 'empty'
    ctx.font = '14px sans-serif'
    ctx.fillText(`Stored: ${stored}`, panelX + 14, panelY + 58)
    ctx.fillText(`Capacity: ${building.count}/${building.capacity}`, panelX + 14, panelY + 80)
    ctx.fillText('G = take 1 item', panelX + 14, panelY + 152)
    return
  }

  if (building.type === 'transport_belt') {
    ctx.fillText('Transport belt', panelX + 14, panelY + 28)
    ctx.font = '14px sans-serif'
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 58)
    ctx.fillText(`Items: ${building.items.length}/8 (15/s)`, panelX + 14, panelY + 80)
    const head = building.items[0]
    ctx.fillText(
      `Front: ${head ? `${formatItemName(head.item)} @ ${head.progress.toFixed(2)}` : 'empty'}`,
      panelX + 14,
      panelY + 102,
    )
    ctx.fillText('F = pick front item', panelX + 14, panelY + 152)
    return
  }

  if (building.type === 'burner_inserter') {
    ctx.fillText('Burner inserter', panelX + 14, panelY + 28)
    ctx.font = '14px sans-serif'
    ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
    ctx.fillText(`Held: ${describe(building.heldItem)}`, panelX + 14, panelY + 102)
    ctx.fillText(`Swing: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
    ctx.fillText('G = take held item', panelX + 14, panelY + 168)
    return
  }

  ctx.fillText('Stone furnace', panelX + 14, panelY + 28)
  ctx.font = '14px sans-serif'
  ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
  ctx.fillText(
    `Input: ${describe(building.inputItem)} ×${building.inputCount}/${building.inputCapacity}`,
    panelX + 14,
    panelY + 80,
  )
  ctx.fillText(
    `Output: ${describe(building.outputItem)} ×${building.outputCount}/${building.outputCapacity}`,
    panelX + 14,
    panelY + 102,
  )
  ctx.fillText(`Progress: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
  ctx.fillText('2×2 footprint', panelX + 14, panelY + 146)
  ctx.fillText('G = take one output item', panelX + 14, panelY + 190)
}
