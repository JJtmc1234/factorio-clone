import { loadGameSprites } from '../../components/gameSprites'
import { setupInput } from '../input'
import { player } from '../player'
import { setupMouse } from '../mouse'
import { TILE_SIZE, chartStarterArea, updateVisibility } from '../world'
import { isInventoryUiOpen } from '../inventory'
import { updateCamera } from '../camera'
import { renderBuildings } from '../buildings'
import { mapState, renderMap } from '../map'
import { state } from './state'
import { update } from './update'
import { drawTerrain, drawGrid, drawObjects } from './terrain'
import { drawPlayer } from './player'
import { drawHoverAndGhost, drawMiningProgress } from './overlay'
import {
  drawBuildUi,
  drawBuildingPanel,
  drawCompactInventory,
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

  drawTerrain(ctx)
  drawGrid(ctx)
  drawObjects(ctx)
  renderBuildings(ctx)
  drawHoverAndGhost(ctx)
  drawPlayer(ctx)
  drawMiningProgress(ctx)
  drawCompactInventory(ctx)
  drawBuildUi(ctx, canvas)

  if (state.openedBuilding) {
    drawBuildingPanel(ctx, canvas, state.openedBuilding)
  }

  if (isInventoryUiOpen()) {
    drawInventoryMenu(ctx, canvas)
  }
}
