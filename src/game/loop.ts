import { loadGameSprites } from '../components/gameSprites'
import { setupInput, input, consumePressed } from './input'
import { player, updatePlayer } from './player'
import { setupMouse, mouse, consumeRightPressed } from './mouse'
import {
  TILE_SIZE,
  getTileAtWorldTile,
  getTileAtScreenPosition,
  getVisibleTileBounds,
  isTileExplored,
  isTileVisible,
  updateVisibility,
} from './world'
import { updateMining, resetMining } from './mining'
import { isInventoryUiOpen, toggleInventoryUi } from './inventory'
import { updateCamera, worldToScreen } from './camera'
import {
  type Direction,
  type BuildSelection,
  type Building,
  canPlaceBuilding,
  fuelBuildingAtTile,
  getBuildingAtTile,
  placeBurnerDrill,
  placeBurnerInserter,
  placeStoneFurnace,
  placeTransportBelt,
  placeWoodenChest,
  removeBuildingAtTile,
  renderBuildings,
  storeOneCoalInBuilding,
  takeOneFromBuilding,
  updateBuildings,
} from './buildings'
import { mapState, renderMap, toggleMap } from './map'

let canvas: HTMLCanvasElement
let ctx: CanvasRenderingContext2D

let started = false
let ownsCanvas = false
let selectedBuild: BuildSelection = null
let openedBuilding: Building | null = null
let buildDirection: Direction = 'right'
let lastTime = performance.now()

export function startGame(
  externalCanvas?: HTMLCanvasElement,
  externalCtx?: CanvasRenderingContext2D,
) {
  if (started) return
  started = true

  if (externalCanvas && externalCtx) {
    canvas = externalCanvas
    ctx = externalCtx
    ownsCanvas = false
  } else {
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

  updateVisibility(
    player.x + player.size / 2,
    player.y + player.size / 2,
    10,
  )

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

function rotateDirection(direction: Direction): Direction {
  if (direction === 'up') return 'right'
  if (direction === 'right') return 'down'
  if (direction === 'down') return 'left'
  return 'up'
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000)
  lastTime = now

  update(dt)
  render()

  requestAnimationFrame(loop)
}

function update(dt: number) {
  if (consumePressed('tab') || consumePressed('i')) {
    toggleInventoryUi()
    if (isInventoryUiOpen()) openedBuilding = null
    resetMining()
  }

  if (consumePressed('m') && !isInventoryUiOpen()) {
    toggleMap()
  }

  if (consumePressed('escape')) {
    selectedBuild = null
    openedBuilding = null
    resetMining()
  }

  if (mapState.open || isInventoryUiOpen()) return

  if (consumePressed('1')) selectedBuild = 'burner_drill'
  if (consumePressed('2')) selectedBuild = 'wooden_chest'
  if (consumePressed('3')) selectedBuild = 'transport_belt'
  if (consumePressed('4')) selectedBuild = 'stone_furnace'
  if (consumePressed('5')) selectedBuild = 'burner_inserter'

  if (consumePressed('r')) {
    buildDirection = rotateDirection(buildDirection)
  }

  updatePlayer(dt, input.keys)

  updateCamera(
    player.x + player.size / 2,
    player.y + player.size / 2,
    canvas.width,
    canvas.height,
  )

  updateVisibility(
    player.x + player.size / 2,
    player.y + player.size / 2,
    10,
  )

  const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
  const hoveredBuilding = hovered
    ? getBuildingAtTile(hovered.tileX, hovered.tileY)
    : null

  if (consumePressed('e')) {
    if (openedBuilding && hoveredBuilding === openedBuilding) {
      openedBuilding = null
    } else {
      openedBuilding = hoveredBuilding
      selectedBuild = null
    }
    resetMining()
  }

  if (consumePressed('x') && hoveredBuilding) {
    if (openedBuilding === hoveredBuilding) {
      openedBuilding = null
    }
    removeBuildingAtTile(hoveredBuilding.tileX, hoveredBuilding.tileY)
    resetMining()
  }

  if (consumeRightPressed() && hovered && selectedBuild) {
    const valid = canPlaceBuilding(selectedBuild, hovered.tileX, hovered.tileY)

    if (valid) {
      if (selectedBuild === 'burner_drill') {
        placeBurnerDrill(hovered.tileX, hovered.tileY, buildDirection)
      } else if (selectedBuild === 'wooden_chest') {
        placeWoodenChest(hovered.tileX, hovered.tileY)
      } else if (selectedBuild === 'transport_belt') {
        placeTransportBelt(hovered.tileX, hovered.tileY, buildDirection)
      } else if (selectedBuild === 'stone_furnace') {
        placeStoneFurnace(hovered.tileX, hovered.tileY)
      } else if (selectedBuild === 'burner_inserter') {
        placeBurnerInserter(hovered.tileX, hovered.tileY, buildDirection)
      }
    }
  }

  if (consumePressed('f') && hovered) {
    const fueled = fuelBuildingAtTile(hovered.tileX, hovered.tileY)
    if (!fueled && openedBuilding) {
      storeOneCoalInBuilding(openedBuilding)
    }
  }

  if (openedBuilding && consumePressed('g')) {
    takeOneFromBuilding(openedBuilding)
  }

  updateBuildings(dt)

  if (!openedBuilding && !selectedBuild) {
    updateMining(dt)
  } else {
    resetMining()
  }
}

function render() {
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (mapState.open) {
    renderMap(ctx, canvas.width, canvas.height)
    return
  }

  drawTerrain()
  drawGrid()
  drawObjects()
  renderBuildings(ctx)
}

function drawTerrain() {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      if (!isTileExplored(tileX, tileY)) continue

      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

      ctx.fillStyle = '#4c8a3f'
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)

      if (!isTileVisible(tileX, tileY)) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
      }
    }
  }
}

function drawGrid() {
  const bounds = getVisibleTileBounds()

  ctx.strokeStyle = '#333'

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      if (!isTileExplored(tileX, tileY)) continue

      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
      ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
    }
  }
}

function drawObjects() {
  const bounds = getVisibleTileBounds()

  for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
      if (!isTileExplored(tileX, tileY)) continue

      const tile = getTileAtWorldTile(tileX, tileY)
      if (!tile.object) continue

      const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

      ctx.fillStyle = '#aaa'
      ctx.fillRect(screen.x + 8, screen.y + 8, 16, 16)
    }
  }
}