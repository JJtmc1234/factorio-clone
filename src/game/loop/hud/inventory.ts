import { inventory } from '../../inventory'
import { mouse } from '../../mouse'
import {
  canCraft,
  getCraftQueue,
  getHandCraftableRecipes,
  startCraft,
} from '../../crafting'
import type { Recipe } from '../../recipes'
import { getGameSprite, isSpriteReady } from '../../../components/gameSprites'

const INVENTORY_SLOTS = 25
const INVENTORY_COLS = 5
const SLOT_SIZE = 56
const SLOT_GAP = 8
const RECIPE_ROW_W = 360
const RECIPE_ROW_H = 60
const RECIPE_ROW_GAP = 6
const PANEL_W = 760
const PANEL_H = 500
const PANEL_PADDING = 20

function recipeItemKey(recipeItemName: string) {
  return recipeItemName.replace(/-/g, '_')
}

function recipeOutputKey(recipe: Recipe) {
  const first = Object.keys(recipe.output)[0]
  return first ? recipeItemKey(first) : null
}

function getInventoryMenuLayout(canvas: HTMLCanvasElement) {
  const panelX = Math.floor((canvas.width - PANEL_W) / 2)
  const panelY = Math.floor((canvas.height - PANEL_H) / 2)
  return {
    panelX,
    panelY,
    panelW: PANEL_W,
    panelH: PANEL_H,
    invStartX: panelX + PANEL_PADDING,
    invStartY: panelY + 60,
    craftStartX: panelX + 380,
    craftStartY: panelY + 60,
    bottomStripY: panelY + PANEL_H - 60,
  }
}

function getCraftRowRect(canvas: HTMLCanvasElement, index: number) {
  const layout = getInventoryMenuLayout(canvas)
  return {
    x: layout.craftStartX,
    y: layout.craftStartY + index * (RECIPE_ROW_H + RECIPE_ROW_GAP),
    w: RECIPE_ROW_W,
    h: RECIPE_ROW_H,
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

function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  item: string,
  cx: number,
  cy: number,
  size: number,
) {
  const sprite = getGameSprite(item)
  if (isSpriteReady(sprite)) {
    ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size)
    return
  }
  ctx.fillStyle = getInventorySwatchColor(item)
  ctx.fillRect(cx - size / 2 + 2, cy - size / 2 + 2, size - 4, size - 4)
}

function drawCountBadge(
  ctx: CanvasRenderingContext2D,
  count: number,
  x: number,
  y: number,
) {
  const text = String(count)
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = 'white'
  ctx.fillText(text, x, y)
  ctx.textAlign = 'left'
}

export function drawCompactInventory(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(20, 20, 20, 0.78)'
  ctx.fillRect(10, 10, 230, 130)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.strokeRect(10, 10, 230, 130)

  ctx.fillStyle = 'white'
  ctx.font = '14px sans-serif'
  ctx.fillText('Inventory  (E)', 20, 30)

  const shown = inventory.slice(0, 4)
  let y = 50
  for (const stack of shown) {
    drawItemIcon(ctx, stack.item, 28, y + 8, 18)
    ctx.fillStyle = 'white'
    ctx.font = '13px sans-serif'
    ctx.fillText(`${stack.item}: ${stack.count}`, 44, y + 12)
    y += 22
  }

  if (shown.length === 0) {
    ctx.fillStyle = '#aaa'
    ctx.font = '13px sans-serif'
    ctx.fillText('(empty)', 20, y + 12)
  }
}

function drawInventoryGrid(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof getInventoryMenuLayout>,
) {
  ctx.fillStyle = 'white'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('Inventory', layout.invStartX, layout.panelY + 38)

  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const col = i % INVENTORY_COLS
    const row = Math.floor(i / INVENTORY_COLS)
    const x = layout.invStartX + col * (SLOT_SIZE + SLOT_GAP)
    const y = layout.invStartY + row * (SLOT_SIZE + SLOT_GAP)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.fillRect(x, y, SLOT_SIZE, SLOT_SIZE)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.strokeRect(x, y, SLOT_SIZE, SLOT_SIZE)

    const stack = inventory[i]
    if (!stack) continue

    drawItemIcon(ctx, stack.item, x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, 36)
    drawCountBadge(ctx, stack.count, x + SLOT_SIZE - 6, y + SLOT_SIZE - 6)
  }
}

function formatIngredients(recipe: Recipe): string {
  const ing = recipe.ingredients
  const entries = Array.isArray(ing)
    ? ing.filter((e) => e.type !== 'fluid').map((e) => [e.name, e.amount] as const)
    : Object.entries(ing)
  return entries.map(([n, a]) => `${a}× ${recipeItemKey(n)}`).join(', ')
}

function drawCraftRow(
  ctx: CanvasRenderingContext2D,
  recipe: Recipe,
  rect: { x: number; y: number; w: number; h: number },
) {
  const craftable = canCraft(recipe.name)
  const hovered =
    mouse.x >= rect.x &&
    mouse.x < rect.x + rect.w &&
    mouse.y >= rect.y &&
    mouse.y < rect.y + rect.h

  ctx.globalAlpha = craftable ? 1 : 0.42
  ctx.fillStyle = hovered && craftable ? 'rgba(255, 255, 255, 0.13)' : 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = craftable ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)'
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  const outputKey = recipeOutputKey(recipe) ?? recipe.name
  drawItemIcon(ctx, outputKey, rect.x + 28, rect.y + rect.h / 2, 40)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(recipe.name, rect.x + 56, rect.y + 22)

  ctx.fillStyle = '#bbb'
  ctx.font = '11px sans-serif'
  ctx.fillText(`${recipe.time}s`, rect.x + rect.w - 40, rect.y + 22)
  ctx.fillText(formatIngredients(recipe), rect.x + 56, rect.y + 42)

  ctx.globalAlpha = 1
}

function drawCraftQueue(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof getInventoryMenuLayout>,
) {
  const stripX = layout.panelX + PANEL_PADDING
  const stripW = layout.panelW - PANEL_PADDING * 2
  const stripY = layout.bottomStripY
  const stripH = 40

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.fillRect(stripX, stripY, stripW, stripH)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.strokeRect(stripX, stripY, stripW, stripH)

  const job = getCraftQueue()[0]
  if (!job) {
    ctx.fillStyle = '#888'
    ctx.font = '13px sans-serif'
    ctx.fillText('No active craft. Click a recipe to start.', stripX + 12, stripY + 25)
    return
  }

  const ratio = 1 - job.remainingTime / Math.max(0.0001, job.totalTime)
  ctx.fillStyle = 'rgba(76, 175, 80, 0.55)'
  ctx.fillRect(stripX, stripY, Math.floor(stripW * ratio), stripH)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText(
    `Crafting ${job.recipeName} ×${job.outputCount}`,
    stripX + 12,
    stripY + 17,
  )
  ctx.fillStyle = '#ddd'
  ctx.font = '11px sans-serif'
  ctx.fillText(
    `${job.remainingTime.toFixed(1)}s remaining (${(ratio * 100).toFixed(0)}%)`,
    stripX + 12,
    stripY + 33,
  )
}

export function drawInventoryMenu(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const layout = getInventoryMenuLayout(canvas)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(26, 26, 26, 0.97)'
  ctx.fillRect(layout.panelX, layout.panelY, layout.panelW, layout.panelH)
  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = 2
  ctx.strokeRect(layout.panelX, layout.panelY, layout.panelW, layout.panelH)

  drawInventoryGrid(ctx, layout)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('Craft', layout.craftStartX, layout.panelY + 38)

  const recipes = getHandCraftableRecipes()
  for (let i = 0; i < recipes.length; i++) {
    drawCraftRow(ctx, recipes[i], getCraftRowRect(canvas, i))
  }

  drawCraftQueue(ctx, layout)

  ctx.fillStyle = '#cfcfcf'
  ctx.font = '12px sans-serif'
  ctx.fillText('E / Esc = close', layout.panelX + PANEL_PADDING, layout.panelY + layout.panelH - 8)
}

export function handleInventoryMenuClick(
  canvas: HTMLCanvasElement,
  mx: number,
  my: number,
): boolean {
  const recipes = getHandCraftableRecipes()
  for (let i = 0; i < recipes.length; i++) {
    const rect = getCraftRowRect(canvas, i)
    if (mx >= rect.x && mx < rect.x + rect.w && my >= rect.y && my < rect.y + rect.h) {
      if (canCraft(recipes[i].name)) {
        startCraft(recipes[i].name)
      }
      return true
    }
  }
  return false
}
