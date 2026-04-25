import type { Building } from '../../buildings'

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
    ctx.fillText('Burner Drill', panelX + 14, panelY + 28)
    const output = building.outputItem
      ? `${building.outputItem} x${building.outputCount}`
      : 'empty'
    ctx.font = '14px sans-serif'
    ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
    ctx.fillText(`Output: ${output}`, panelX + 14, panelY + 102)
    ctx.fillText('2x2 footprint', panelX + 14, panelY + 124)
    ctx.fillText('F = add coal/wood fuel', panelX + 14, panelY + 146)
    ctx.fillText('G = take one output item', panelX + 14, panelY + 168)
    return
  }

  if (building.type === 'wooden_chest') {
    ctx.fillText('Wooden Chest', panelX + 14, panelY + 28)
    const stored = building.item ? `${building.item} x${building.count}` : 'empty'
    ctx.font = '14px sans-serif'
    ctx.fillText(`Stored: ${stored}`, panelX + 14, panelY + 58)
    ctx.fillText(`Capacity: ${building.count}/${building.capacity}`, panelX + 14, panelY + 80)
    ctx.fillText('F = store 1 coal', panelX + 14, panelY + 132)
    ctx.fillText('G = take 1 item', panelX + 14, panelY + 152)
    return
  }

  if (building.type === 'transport_belt') {
    ctx.fillText('Transport Belt', panelX + 14, panelY + 28)
    ctx.font = '14px sans-serif'
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 58)
    ctx.fillText(`Item: ${building.item ?? 'empty'}`, panelX + 14, panelY + 80)
    ctx.fillText(
      `Progress: ${building.item ? building.itemProgress.toFixed(2) : '0.00'}`,
      panelX + 14,
      panelY + 102,
    )
    ctx.fillText('F = place 1 coal on belt', panelX + 14, panelY + 132)
    ctx.fillText('G = take belt item', panelX + 14, panelY + 152)
    return
  }

  if (building.type === 'burner_inserter') {
    ctx.fillText('Burner Inserter', panelX + 14, panelY + 28)
    ctx.font = '14px sans-serif'
    ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
    ctx.fillText(`Direction: ${building.direction}`, panelX + 14, panelY + 80)
    ctx.fillText(`Held: ${building.heldItem ?? 'empty'}`, panelX + 14, panelY + 102)
    ctx.fillText(`Swing: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
    ctx.fillText('F = add coal fuel', panelX + 14, panelY + 146)
    ctx.fillText('G = take held item', panelX + 14, panelY + 168)
    return
  }

  ctx.fillText('Stone Furnace', panelX + 14, panelY + 28)
  ctx.font = '14px sans-serif'
  ctx.fillText(`Fuel: ${building.fuel.toFixed(1)}`, panelX + 14, panelY + 58)
  ctx.fillText(
    `Input: ${building.inputItem ?? 'empty'} x${building.inputCount}/${building.inputCapacity}`,
    panelX + 14,
    panelY + 80,
  )
  ctx.fillText(
    `Output: ${building.outputItem ?? 'empty'} x${building.outputCount}/${building.outputCapacity}`,
    panelX + 14,
    panelY + 102,
  )
  ctx.fillText(`Progress: ${building.progress.toFixed(2)}`, panelX + 14, panelY + 124)
  ctx.fillText('2x2 footprint', panelX + 14, panelY + 146)
  ctx.fillText('F = add coal/wood fuel', panelX + 14, panelY + 168)
  ctx.fillText('G = take one output item', panelX + 14, panelY + 190)
}
