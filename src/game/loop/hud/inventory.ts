import { inventory } from '../../inventory'
import { mouse } from '../../mouse'
import {
  canCraft,
  getCraftQueue,
  getHandCraftableRecipes,
  startCraft,
} from '../../crafting'
import type { Recipe } from '../../recipes'
import { formatItemName } from '../../format'
import { getGameSprite, isSpriteReady } from '../../../components/gameSprites'

const INVENTORY_SLOTS = 25
const INVENTORY_COLS = 5
const SLOT_SIZE = 56
const SLOT_GAP = 8
const PANEL_W = 760
const PANEL_H = 500
const PANEL_PADDING = 20

// Recipe grid (right half).
const RECIPE_GRID_COLS = 8
const RECIPE_CELL_SIZE = 38
const RECIPE_CELL_GAP = 4
const TAB_W = 56
const TAB_H = 36
const TAB_GAP = 4

// Persistent across frames so scroll + tab selection survive a redraw.
let recipeScrollOffset = 0

type CraftSection = 'Logistics' | 'Production' | 'Intermediate' | 'Combat'
type TabKey = CraftSection | 'All'

const SECTION_ORDER: CraftSection[] = [
  'Logistics',
  'Production',
  'Intermediate',
  'Combat',
]
const TAB_ORDER: TabKey[] = ['All', ...SECTION_ORDER]
let activeTab: TabKey = 'All'

// Each tab is illustrated by an iconic recipe output. Falls back to a
// solid color if the sprite isn't ready yet.
const TAB_ICONS: Record<TabKey, string> = {
  All: 'iron_gear_wheel',
  Logistics: 'transport_belt',
  Production: 'burner_drill',
  Intermediate: 'iron_plate',
  Combat: 'firearm_magazine',
}

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

function getRecipesForActiveTab(): Recipe[] {
  const all = getHandCraftableRecipes()
  if (activeTab === 'All') return all
  return all.filter((r) => recipeSection(r) === activeTab)
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
    // Tab strip y, then a small gap, then the grid starts.
    tabStripY: panelY + 60,
    gridStartY: panelY + 60 + TAB_H + 8,
    bottomStripY: panelY + PANEL_H - 60,
  }
}

function getTabRect(canvas: HTMLCanvasElement, idx: number) {
  const layout = getInventoryMenuLayout(canvas)
  return {
    x: layout.craftStartX + idx * (TAB_W + TAB_GAP),
    y: layout.tabStripY,
    w: TAB_W,
    h: TAB_H,
  }
}

function getRecipeGridBounds(canvas: HTMLCanvasElement) {
  const layout = getInventoryMenuLayout(canvas)
  return {
    x: layout.craftStartX,
    y: layout.gridStartY,
    w: RECIPE_GRID_COLS * RECIPE_CELL_SIZE + (RECIPE_GRID_COLS - 1) * RECIPE_CELL_GAP,
    h: layout.bottomStripY - layout.gridStartY - 8,
  }
}

function getRecipeCellRect(canvas: HTMLCanvasElement, idx: number) {
  const grid = getRecipeGridBounds(canvas)
  const col = idx % RECIPE_GRID_COLS
  const row = Math.floor(idx / RECIPE_GRID_COLS)
  return {
    x: grid.x + col * (RECIPE_CELL_SIZE + RECIPE_CELL_GAP),
    y: grid.y + row * (RECIPE_CELL_SIZE + RECIPE_CELL_GAP),
    w: RECIPE_CELL_SIZE,
    h: RECIPE_CELL_SIZE,
  }
}

function getMaxVisibleRecipeRows(layout: { gridStartY: number; bottomStripY: number }) {
  const available = layout.bottomStripY - layout.gridStartY - 8
  return Math.max(0, Math.floor(available / (RECIPE_CELL_SIZE + RECIPE_CELL_GAP)))
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
    ctx.fillText(`${formatItemName(stack.item)}: ${stack.count}`, 44, y + 12)
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

function drawRecipeCell(
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

  // Slot background.
  ctx.fillStyle = hovered ? 'rgba(255, 200, 80, 0.22)' : 'rgba(255, 255, 255, 0.06)'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = hovered
    ? '#ffb74d'
    : craftable
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = hovered ? 2 : 1
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.lineWidth = 1

  // Output icon, big.
  const outputKey = recipeOutputKey(recipe) ?? recipe.name
  drawItemIcon(ctx, outputKey, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 8)

  // Output count badge, bottom-right of the cell.
  const outputs = Object.entries(recipe.output)
  if (outputs.length > 0 && outputs[0][1] > 1) {
    drawCountBadge(ctx, outputs[0][1], rect.x + rect.w - 4, rect.y + rect.h - 4)
  }

  ctx.globalAlpha = 1
}

function drawTabStrip(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const tab = TAB_ORDER[i]
    const r = getTabRect(canvas, i)
    const isActive = tab === activeTab
    const hovered =
      mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h

    ctx.fillStyle = isActive
      ? 'rgba(255, 200, 80, 0.22)'
      : hovered
        ? 'rgba(255, 255, 255, 0.13)'
        : 'rgba(255, 255, 255, 0.05)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = isActive ? '#ffb74d' : 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = isActive ? 2 : 1
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.lineWidth = 1

    drawItemIcon(ctx, TAB_ICONS[tab], r.x + r.w / 2, r.y + r.h / 2, 26)
  }
}

// Rich hover tooltip for a recipe cell. Floats next to the cursor, drawn
// last so it sits on top of everything else.
function drawRecipeTooltip(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  recipe: Recipe,
) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .filter((e) => e.type !== 'fluid')
        .map((e) => [e.name, e.amount] as const)
    : (Object.entries(recipe.ingredients) as Array<readonly [string, number]>)

  const outputs = Object.entries(recipe.output) as Array<readonly [string, number]>
  const lineH = 18
  const padding = 10
  const tooltipW = 240
  const headerH = 26
  const ingredientsH = 18 + ingredients.length * lineH
  const outputsH = 18 + outputs.length * lineH
  const metaH = 18 + lineH * (1 + (recipe.madeIn?.length ?? 0))
  const tooltipH = headerH + ingredientsH + outputsH + metaH + padding

  // Position the tooltip near the cursor but clamp to canvas.
  let x = mouse.x + 14
  let y = mouse.y + 12
  if (x + tooltipW > canvas.width - 4) x = canvas.width - 4 - tooltipW
  if (y + tooltipH > canvas.height - 4) y = canvas.height - 4 - tooltipH
  if (x < 4) x = 4
  if (y < 4) y = 4

  // Background card.
  ctx.fillStyle = 'rgba(20, 20, 20, 0.96)'
  ctx.fillRect(x, y, tooltipW, tooltipH)
  ctx.strokeStyle = '#bdbdbd'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, tooltipW, tooltipH)

  let cy = y + 8

  // Header: "<Item name> (Recipe)"
  ctx.fillStyle = '#ffe082'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(`${formatItemName(recipe.name)} (Recipe)`, x + padding, cy + 14)
  cy += headerH

  // Ingredients section.
  ctx.fillStyle = '#bdbdbd'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('Ingredients', x + padding, cy + 12)
  cy += 16
  ctx.font = '12px sans-serif'
  for (const [name, amount] of ingredients) {
    drawItemIcon(ctx, recipeItemKey(name), x + padding + 8, cy + 8, 14)
    ctx.fillStyle = 'white'
    ctx.fillText(`${amount} × ${formatItemName(name)}`, x + padding + 22, cy + 12)
    cy += lineH
  }

  // Output section.
  ctx.fillStyle = '#bdbdbd'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('Output', x + padding, cy + 12)
  cy += 16
  ctx.font = '12px sans-serif'
  for (const [name, amount] of outputs) {
    drawItemIcon(ctx, recipeItemKey(name), x + padding + 8, cy + 8, 14)
    ctx.fillStyle = 'white'
    ctx.fillText(`${amount} × ${formatItemName(name)}`, x + padding + 22, cy + 12)
    cy += lineH
  }

  // Meta section: time + made-in.
  ctx.fillStyle = '#bdbdbd'
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('Recipe', x + padding, cy + 12)
  cy += 16
  ctx.fillStyle = 'white'
  ctx.font = '12px sans-serif'
  ctx.fillText(`${recipe.time}s crafting time`, x + padding + 8, cy + 12)
  cy += lineH
  if (recipe.madeIn?.length) {
    ctx.fillText(`Made in: ${recipe.madeIn.join(', ')}`, x + padding + 8, cy + 12)
  }
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
  ctx.fillText(`${formatItemName(head.recipeName)} ×${head.outputCount}`, stripX + 8, stripY + 16)
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

  drawTabStrip(ctx, canvas)

  const recipes = getRecipesForActiveTab()
  const grid = getRecipeGridBounds(canvas)
  const maxRows = getMaxVisibleRecipeRows(layout)
  const totalRows = Math.ceil(recipes.length / RECIPE_GRID_COLS)
  const maxScroll = Math.max(0, totalRows - maxRows)
  if (recipeScrollOffset < 0) recipeScrollOffset = 0
  if (recipeScrollOffset > maxScroll) recipeScrollOffset = maxScroll

  // Find the recipe under the cursor while drawing — saves a second pass.
  let hoveredRecipe: Recipe | null = null
  const startIdx = recipeScrollOffset * RECIPE_GRID_COLS
  for (let i = startIdx; i < recipes.length; i++) {
    const localIdx = i - startIdx
    const cellRect = getRecipeCellRect(canvas, localIdx)
    if (cellRect.y + cellRect.h > grid.y + grid.h) break
    drawRecipeCell(ctx, recipes[i], cellRect)
    if (
      mouse.x >= cellRect.x &&
      mouse.x < cellRect.x + cellRect.w &&
      mouse.y >= cellRect.y &&
      mouse.y < cellRect.y + cellRect.h
    ) {
      hoveredRecipe = recipes[i]
    }
  }

  // Scrollbar indicator on the right edge of the recipe grid.
  if (totalRows > 0 && maxScroll > 0) {
    const trackX = grid.x + grid.w + 2
    const trackW = 4
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(trackX, grid.y, trackW, grid.h)
    const thumbH = Math.max(20, Math.floor((maxRows / totalRows) * grid.h))
    const thumbY =
      grid.y + Math.floor((recipeScrollOffset / maxScroll) * (grid.h - thumbH))
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fillRect(trackX, thumbY, trackW, thumbH)
  }

  drawCraftQueue(ctx, layout)

  ctx.fillStyle = '#cfcfcf'
  ctx.font = '12px sans-serif'
  ctx.fillText('E / Esc = close', layout.panelX + PANEL_PADDING, layout.panelY + layout.panelH - 8)

  // Tooltip is drawn LAST so it sits on top of the rest of the menu.
  if (hoveredRecipe) drawRecipeTooltip(ctx, canvas, hoveredRecipe)
}

export function isOverRecipeArea(canvas: HTMLCanvasElement, mx: number, my: number) {
  const grid = getRecipeGridBounds(canvas)
  return mx >= grid.x && mx < grid.x + grid.w && my >= grid.y && my < grid.y + grid.h
}

export function scrollRecipeList(deltaY: number) {
  if (deltaY === 0) return
  recipeScrollOffset += deltaY > 0 ? 1 : -1
}

export function handleInventoryMenuClick(
  canvas: HTMLCanvasElement,
  mx: number,
  my: number,
): boolean {
  // Tab strip first.
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const r = getTabRect(canvas, i)
    if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
      activeTab = TAB_ORDER[i]
      recipeScrollOffset = 0
      return true
    }
  }

  // Recipe grid hit-test, honoring the scroll offset.
  const recipes = getRecipesForActiveTab()
  const grid = getRecipeGridBounds(canvas)
  const startIdx = recipeScrollOffset * RECIPE_GRID_COLS
  for (let i = startIdx; i < recipes.length; i++) {
    const localIdx = i - startIdx
    const cellRect = getRecipeCellRect(canvas, localIdx)
    if (cellRect.y + cellRect.h > grid.y + grid.h) break
    if (
      mx >= cellRect.x &&
      mx < cellRect.x + cellRect.w &&
      my >= cellRect.y &&
      my < cellRect.y + cellRect.h
    ) {
      // startCraft will auto-queue prerequisite intermediates if the player
      // has the raw materials but not the immediate ingredients.
      startCraft(recipes[i].name)
      return true
    }
  }
  return false
}
