import { inventory } from '../../inventory'

export function drawCompactInventory(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fillRect(10, 10, 230, 120)

  ctx.fillStyle = 'black'
  ctx.font = '14px sans-serif'
  ctx.fillText('Inventory', 20, 30)

  let y = 52
  const shown = inventory.slice(0, 4)
  for (const stack of shown) {
    ctx.fillText(`${stack.item}: ${stack.count}`, 20, y)
    y += 18
  }

  if (shown.length === 0) {
    ctx.fillText('(empty)', 20, y)
  }
}

function getInventorySwatchColor(item: string) {
  if (item === 'coal') return '#1a1a1d'
  if (item === 'iron_ore') return '#9aa3ad'
  if (item === 'copper_ore') return '#c98046'
  if (item === 'stone') return '#bdbdbd'
  if (item === 'wood') return '#8b5a2b'
  if (item === 'iron_plate') return '#eceff4'
  if (item === 'copper_plate') return '#d08a45'
  if (item === 'stone_brick') return '#cfcfcf'
  return '#8bc34a'
}

export function drawInventoryMenu(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const panelW = 520
  const panelH = 340
  const panelX = Math.floor((canvas.width - panelW) / 2)
  const panelY = Math.floor((canvas.height - panelH) / 2)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(26, 26, 26, 0.96)'
  ctx.fillRect(panelX, panelY, panelW, panelH)

  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = 2
  ctx.strokeRect(panelX, panelY, panelW, panelH)

  ctx.fillStyle = 'white'
  ctx.font = '22px sans-serif'
  ctx.fillText('Inventory', panelX + 18, panelY + 32)

  const cols = 5
  const slotSize = 84
  const startX = panelX + 18
  const startY = panelY + 56

  for (let i = 0; i < 15; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = startX + col * (slotSize + 10)
    const y = startY + row * (slotSize + 10)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(x, y, slotSize, slotSize)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.strokeRect(x, y, slotSize, slotSize)

    const stack = inventory[i]
    if (!stack) continue

    ctx.fillStyle = getInventorySwatchColor(stack.item)
    ctx.fillRect(x + 10, y + 10, 20, 20)
    ctx.fillStyle = 'white'
    ctx.font = '13px sans-serif'
    ctx.fillText(stack.item, x + 10, y + 46)
    ctx.fillText(`x${stack.count}`, x + 10, y + 64)
  }

  ctx.fillStyle = '#e0e0e0'
  ctx.font = '14px sans-serif'
  ctx.fillText('Tab / I / Esc = close', panelX + 18, panelY + panelH - 18)
}
