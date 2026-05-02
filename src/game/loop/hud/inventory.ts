import { inventory } from '../../inventory'
import { consumeWheelDelta, mouse } from '../../mouse'
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
const RECIPE_ROW_H = 36
const RECIPE_ROW_GAP = 3
const SECTION_HEADER_H = 20
const PANEL_W = 760
const PANEL_H = 500
const PANEL_PADDING = 20

// Persistent across frames so the scroll position survives a redraw.
let recipeScrollOffset = 0

type CraftSection = 'Logistics' | 'Production' | 'Intermediate' | 'Combat'

const SECTION_ORDER: CraftSection[] = [
  'Logistics',
  'Production',
  'Intermediate',
  'Combat',
]

function recipeSection(recipe: Recipe): CraftSection {
  const name = recipe.name
  if (
    name === 'wooden-chest' ||
    name === 'iron-chest' ||
    name === 'transport-belt' ||
    name === 'burner-inserter' ||
    name === 'inserter'
  )
    return 'Logistics'
  if (name === 'stone-furnace' || name === 'burner-mining-drill') return 'Production'
  if (name === 'firearm-magazine' || name === 'light-armor' || name === 'pistol')
    return 'Combat'
  return 'Intermediate'
}

type FlatRow =
  | { kind: 'header'; section: CraftSection; height: number }
  | { kind: 'recipe'; recipe: Recipe; height: number }

function buildFlatRows(): FlatRow[] {
  const recipes = getHandCraftableRecipes()
  const bySection = new Map<CraftSection, Recipe[]>()
  for (const r of recipes) {
    const s = recipeSection(r)
    if (!bySection.has(s)) bySection.set(s, [])
    bySection.get(s)!.push(r)
  }
  const rows: FlatRow[] = []
  for (const section of SECTION_ORDER) {
    const list = bySection.get(section)
    if (!list || list.length === 0) continue
    rows.push({ kind: 'header', section, height: SECTION_HEADER_H })
    for (const r of list) rows.push({ kind: 'recipe', recipe: r, height: RECIPE_ROW_H })
  }
  return rows
}

function getMaxVisibleRecipeRows(layout: { craftStartY: number; bottomStripY: number }) {
  const available = layout.bottomStripY - layout.craftStartY - 8
  return Math.max(0, Math.floor(available / (RECIPE_ROW_H + RECIPE_ROW_GAP)))
}

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

function getRecipeAreaBounds(canvas: HTMLCanvasElement) {
  const layout = getInventoryMenuLayout(canvas)
  return {
    x: layout.craftStartX,
    y: layout.craftStartY,
    w: RECIPE_ROW_W,
    h: layout.bottomStripY - layout.craftStartY - 8,
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
  drawItemIcon(ctx, outputKey, rect.x + 18, rect.y + rect.h / 2, 26)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(recipe.name, rect.x + 36, rect.y + 14)

  ctx.fillStyle = '#bbb'
  ctx.font = '10px sans-serif'
  ctx.fillText(`${recipe.time}s`, rect.x + rect.w - 32, rect.y + 14)
  ctx.fillText(formatIngredients(recipe), rect.x + 36, rect.y + 28)

  ctx.globalAlpha = 1
}

function drawSectionHeader(
  ctx: CanvasRenderingContext2D,
  section: CraftSection,
  rect: { x: number; y: number; w: number; h: number },
) {
  ctx.fillStyle = 'rgba(255, 200, 100, 0.18)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.fillStyle = '#ffd180'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText(section.toUpperCase(), rect.x + 6, rect.y + 14)
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

  const queue = getCraftQueue()
  if (queue.length === 0) {
    ctx.fillStyle = '#888'
    ctx.font = '13px sans-serif'
    ctx.fillText('No active craft. Click a recipe to start.', stripX + 12, stripY + 25)
    return
  }

  // Active job (head) — left side, with progress overlay + label.
  const head = queue[0]
  const headW = 250
  const ratio = 1 - head.remainingTime / Math.max(0.0001, head.totalTime)
  ctx.fillStyle = 'rgba(76, 175, 80, 0.55)'
  ctx.fillRect(stripX, stripY, Math.floor(headW * ratio), stripH)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(`${head.recipeName} ×${head.outputCount}`, stripX + 8, stripY + 16)
  ctx.fillStyle = '#ddd'
  ctx.font = '10px sans-serif'
  ctx.fillText(`${head.remainingTime.toFixed(1)}s`, stripX + 8, stripY + 31)

  // Pending jobs — right side, as small slot icons with stack count.
  const slotsX = stripX + headW + 8
  const slotW = 32
  const slotGap = 4
  const slotsAvailable = Math.max(0, Math.floor((stripW - headW - 8) / (slotW + slotGap)))
  const pending = queue.slice(1, 1 + slotsAvailable)
  for (let i = 0; i < pending.length; i++) {
    const x = slotsX + i * (slotW + slotGap)
    const y = stripY + 4
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(x, y, slotW, slotW)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.strokeRect(x, y, slotW, slotW)
    drawItemIcon(ctx, pending[i].outputItem, x + slotW / 2, y + slotW / 2, 22)
    if (pending[i].outputCount > 1) {
      drawCountBadge(ctx, pending[i].outputCount, x + slotW - 3, y + slotW - 3)
    }
  }

  const overflow = queue.length - 1 - pending.length
  if (overflow > 0) {
    ctx.fillStyle = 'white'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`+${overflow}`, stripX + stripW - 6, stripY + stripH - 6)
    ctx.textAlign = 'left'
  }
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

  const flatRows = buildFlatRows()
  const area = getRecipeAreaBounds(canvas)

  // Wheel scroll while pointer is over the recipe area.
  const overArea =
    mouse.x >= area.x &&
    mouse.x < area.x + area.w &&
    mouse.y >= area.y &&
    mouse.y < area.y + area.h
  if (overArea) {
    const dy = consumeWheelDelta()
    if (dy !== 0) {
      const step = dy > 0 ? 1 : -1
      recipeScrollOffset += step
    }
  }

  const maxScroll = Math.max(0, flatRows.length - getMaxVisibleRecipeRows(layout))
  if (recipeScrollOffset < 0) recipeScrollOffset = 0
  if (recipeScrollOffset > maxScroll) recipeScrollOffset = maxScroll

  let cursorY = area.y
  for (let i = recipeScrollOffset; i < flatRows.length; i++) {
    const row = flatRows[i]
    if (cursorY + row.height > area.y + area.h) break
    const rect = { x: area.x, y: cursorY, w: area.w, h: row.height }
    if (row.kind === 'header') drawSectionHeader(ctx, row.section, rect)
    else drawCraftRow(ctx, row.recipe, rect)
    cursorY += row.height + RECIPE_ROW_GAP
  }

  // Scrollbar indicator on the right edge of the recipe area.
  if (flatRows.length > 0 && maxScroll > 0) {
    const trackX = area.x + area.w + 2
    const trackW = 4
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(trackX, area.y, trackW, area.h)
    const visible = getMaxVisibleRecipeRows(layout)
    const thumbH = Math.max(20, Math.floor((visible / flatRows.length) * area.h))
    const thumbY =
      area.y + Math.floor((recipeScrollOffset / maxScroll) * (area.h - thumbH))
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fillRect(trackX, thumbY, trackW, thumbH)
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
  const flatRows = buildFlatRows()
  const area = getRecipeAreaBounds(canvas)

  let cursorY = area.y
  for (let i = recipeScrollOffset; i < flatRows.length; i++) {
    const row = flatRows[i]
    if (cursorY + row.height > area.y + area.h) break
    if (
      row.kind === 'recipe' &&
      mx >= area.x &&
      mx < area.x + area.w &&
      my >= cursorY &&
      my < cursorY + row.height
    ) {
      // startCraft will auto-queue prerequisite intermediates if the player
      // has the raw materials but not the immediate ingredients.
      startCraft(row.recipe.name)
      return true
    }
    cursorY += row.height + RECIPE_ROW_GAP
  }
  return false
}
