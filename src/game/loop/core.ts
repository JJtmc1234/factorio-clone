import { loadGameSprites } from '../../components/gameSprites'
import { setupInput } from '../input'
import { player } from '../player'
import { setupMouse } from '../mouse'
import { TILE_SIZE, chartStarterArea, updateVisibility } from '../world'
import { addItem, isInventoryUiOpen } from '../inventory'
import { applyWorldTransform, restoreWorldTransform, updateCamera } from '../camera'
import { renderBuildings } from '../buildings'
import { mapState, renderMap } from '../map'
import { state } from './state'
import { update } from './update'
import { drawTerrain, drawGrid, drawObjects } from './terrain'
import { drawPlayer } from './player'
import { drawHoverAndGhost, drawMiningProgress } from './overlay'
import {
  drawBuildingPanel,
  drawCompactInventory,
  drawDebugButton,
  drawInventoryMenu,
} from './hud'

let canvas: HTMLCanvasElement
let ctx: CanvasRenderingContext2D
let started = false
let ownsCanvas = false
let lastTime = performance.now()

export function startGame(
  externalCanvas?: HTMLCanvasElement,
  externalCtx?: CanvasRenderingContext2D,
) {
  if (externalCanvas && externalCtx) {
    canvas = externalCanvas
    ctx = externalCtx
    ownsCanvas = false
  } else if (!started) {
    canvas = document.createElement('canvas')
    const createdCtx = canvas.getContext('2d')

    if (!createdCtx) {
      throw new Error('Could not create canvas rendering context')
    }

    ctx = createdCtx
    ownsCanvas = true
    document.body.appendChild(canvas)
  }

  resizeCanvas()

  if (started) {
    setupMouse(canvas)
    return
  }

  started = true

  window.addEventListener('resize', resizeCanvas)

  setupInput()
  setupMouse(canvas)
  loadGameSprites()

  // Starter inventory matches the Factorio Freeplay default documented on
  // wiki.factorio.com/Character (history note, since 0.8.0): 1 burner
  // mining drill + 1 stone furnace. Player crafts everything else from
  // raw materials they mine by hand.
  addItem('burner_mining_drill', 1)
  addItem('stone_furnace', 1)

  updateCamera(
    player.x + player.size / 2,
    player.y + player.size / 2,
    canvas.width,
    canvas.height,
  )

  chartStarterArea(
    Math.floor((player.x + player.size / 2) / TILE_SIZE),
    Math.floor((player.y + player.size / 2) / TILE_SIZE),
    3,
  )

  updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

  lastTime = performance.now()
  requestAnimationFrame(loop)
}

function resizeCanvas() {
  if (!canvas) return

  if (ownsCanvas) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    return
  }

  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 1))
  canvas.height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 1))
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000)
  lastTime = now

  update(dt, canvas)
  render()

  requestAnimationFrame(loop)
}

function render() {
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (mapState.open) {
    renderMap(ctx, canvas.width, canvas.height)
    return
  }

  // World rendering happens in zoom-scaled space. Everything that uses
  // worldToScreen draws in this transformed ctx; the HUD passes below
  // run in the unscaled (screen-pixel) ctx after restore.
  applyWorldTransform(ctx)
  drawTerrain(ctx)
  drawGrid(ctx)
  drawObjects(ctx)
  renderBuildings(ctx)
  drawHoverAndGhost(ctx)
  drawPlayer(ctx)
  drawMiningProgress(ctx)
  restoreWorldTransform(ctx)

  drawCompactInventory(ctx)

  // Inventory underneath, entity panel on top — when both are open (the
  // Factorio "open chest" / "open furnace" pattern) the player sees the
  // inventory grid alongside the entity-specific panel. Drawing entity
  // last keeps it visible regardless of inventory width.
  if (isInventoryUiOpen()) {
    drawInventoryMenu(ctx, canvas)
  }

  if (state.openedBuilding) {
    drawBuildingPanel(ctx, canvas, state.openedBuilding)
  }

  // Debug button is always on top so it's reachable even when menus are open.
  drawDebugButton(ctx, canvas)
}
