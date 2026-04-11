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
import { updateMining, getMiningProgress, getMiningTarget } from './mining'
import { inventory } from './inventory'
import { updateCamera, worldToScreen } from './camera'
import {
  type Direction,
  type BuildSelection,
  canPlaceBuilding,
  fuelBuildingAtTile,
  getBuildingAtTile,
  getBuildingTooltipLines,
  getPrimaryBuildingTile,
  placeBurnerDrill,
  placeWoodenChest,
  renderBuildingGhost,
  renderBuildings,
  updateBuildings,
} from './buildings'
import { mapState, renderMap, toggleMap } from './map'

let running = false

function rotateDirection(direction: Direction): Direction {
  if (direction === 'down') return 'left'
  if (direction === 'left') return 'up'
  if (direction === 'up') return 'right'
  return 'down'
}

export function startGame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  if (running) return
  running = true

  setupInput()
  setupMouse(canvas)

  let selectedBuild: BuildSelection = null
  let buildDirection: Direction = 'down'
  let last = performance.now()

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    update(dt)
    render()

    requestAnimationFrame(loop)
  }

  function update(dt: number) {
    if (consumePressed('m')) {
      toggleMap()
    }

    if (consumePressed('1')) {
      selectedBuild = 'burner_drill'
    }

    if (consumePressed('2')) {
      selectedBuild = 'wooden_chest'
    }

    if (consumePressed('r')) {
      buildDirection = rotateDirection(buildDirection)
    }

    if (consumePressed('escape')) {
      selectedBuild = null
    }

    if (!mapState.open) {
      updatePlayer(dt, input.keys)

      updateCamera(
        player.x + player.size / 2,
        player.y + player.size / 2,
        canvas.width,
        canvas.height,
      )
      updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

      const hovered = getTileAtScreenPosition(mouse.x, mouse.y)

      if (consumeRightPressed() && hovered && selectedBuild) {
        const valid = canPlaceBuilding(selectedBuild, hovered.tileX, hovered.tileY)

        if (valid) {
          if (selectedBuild === 'burner_drill') {
            placeBurnerDrill(hovered.tileX, hovered.tileY, buildDirection)
          } else if (selectedBuild === 'wooden_chest') {
            placeWoodenChest(hovered.tileX, hovered.tileY)
          }
        }
      }

      if (consumePressed('f') && hovered) {
        fuelBuildingAtTile(hovered.tileX, hovered.tileY)
      }

      updateBuildings(dt)
      updateMining(dt)
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
    drawHoverAndGhost()
    drawPlayer()
    drawMiningProgress()
    drawInventoryDebug()
    drawBuildUi()
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
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
          ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  function drawGrid() {
    const bounds = getVisibleTileBounds()

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

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
        const object = tile.object
        if (!object) continue

        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

        if (object.type === 'tree') {
          ctx.fillStyle = '#6b4f2a'
          ctx.fillRect(screen.x + 13, screen.y + 16, 6, 10)

          ctx.fillStyle = '#2e8b57'
          ctx.fillRect(screen.x + 8, screen.y + 7, 16, 10)
          ctx.fillRect(screen.x + 6, screen.y + 12, 8, 8)
          ctx.fillRect(screen.x + 18, screen.y + 12, 8, 8)
        }

        if (object.type === 'iron_ore') {
          ctx.fillStyle = '#5f646b'
          ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

          ctx.fillStyle = '#9aa3ad'
          ctx.fillRect(screen.x + 9, screen.y + 10, 5, 5)
          ctx.fillRect(screen.x + 16, screen.y + 13, 4, 4)
          ctx.fillRect(screen.x + 20, screen.y + 10, 3, 3)
        }

        if (object.type === 'coal') {
          ctx.fillStyle = '#1e1e22'
          ctx.fillRect(screen.x + 6, screen.y + 8, 20, 16)

          ctx.fillStyle = '#3a3a40'
          ctx.fillRect(screen.x + 10, screen.y + 11, 4, 3)
          ctx.fillRect(screen.x + 17, screen.y + 14, 3, 3)
          ctx.fillRect(screen.x + 20, screen.y + 10, 3, 2)
        }

        if (!isTileVisible(tileX, tileY)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
          ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  function drawPlayer() {
    const screen = worldToScreen(player.x, player.y)
    drawPlayerSprite(screen.x, screen.y)
  }

  function drawPlayerSprite(screenX: number, screenY: number) {
    const walkFrame = Math.floor(player.animTime) % 2
    const legOffset = player.moving ? (walkFrame === 0 ? -2 : 2) : 0
    const armOffset = player.moving ? (walkFrame === 0 ? 2 : -2) : 0

    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(screenX + 12, screenY + 22, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#2f5aa8'
    ctx.fillRect(screenX + 7, screenY + 15, 4, 8 + legOffset)
    ctx.fillRect(screenX + 13, screenY + 15, 4, 8 - legOffset)

    ctx.fillStyle = '#4da6ff'
    ctx.fillRect(screenX + 6, screenY + 7, 12, 10)

    ctx.fillStyle = '#f2c18d'
    ctx.fillRect(screenX + 3, screenY + 8, 3, 7 + armOffset)
    ctx.fillRect(screenX + 18, screenY + 8, 3, 7 - armOffset)

    ctx.fillStyle = '#f2c18d'
    ctx.fillRect(screenX + 7, screenY + 1, 10, 8)

    ctx.fillStyle = '#111'
    if (player.facing === 'down') {
      ctx.fillRect(screenX + 9, screenY + 4, 1, 1)
      ctx.fillRect(screenX + 13, screenY + 4, 1, 1)
    }

    if (player.facing === 'up') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 8, screenY + 8, 8, 6)
    } else if (player.facing === 'left') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 6, screenY + 9, 3, 6)
    } else if (player.facing === 'right') {
      ctx.fillStyle = '#224477'
      ctx.fillRect(screenX + 15, screenY + 9, 3, 6)
    }
  }

  function drawHoverAndGhost() {
    const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
    if (!hovered || !isTileExplored(hovered.tileX, hovered.tileY)) return

    const screen = worldToScreen(hovered.tileX * TILE_SIZE, hovered.tileY * TILE_SIZE)

    if (selectedBuild) {
      const valid = canPlaceBuilding(selectedBuild, hovered.tileX, hovered.tileY)
      renderBuildingGhost(ctx, selectedBuild, hovered.tileX, hovered.tileY, buildDirection, valid)
    } else {
      ctx.strokeStyle = 'yellow'
      ctx.lineWidth = 2
      ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    }

    const building = getBuildingAtTile(hovered.tileX, hovered.tileY)
    if (!building) return

    const primary = getPrimaryBuildingTile(building)
    const primaryScreen = worldToScreen(primary.x * TILE_SIZE, primary.y * TILE_SIZE)
    const lines = getBuildingTooltipLines(building)
    const boxWidth = 240
    const boxHeight = 18 + lines.length * 15

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(primaryScreen.x, primaryScreen.y - boxHeight - 4, boxWidth, boxHeight)

    ctx.fillStyle = 'white'
    ctx.font = '12px sans-serif'

    lines.forEach((line, index) => {
      ctx.fillText(line, primaryScreen.x + 6, primaryScreen.y - boxHeight + 12 + index * 15)
    })
  }

  function drawMiningProgress() {
    const target = getMiningTarget()
    if (!target || !isTileExplored(target.tileX, target.tileY)) return

    const progress = getMiningProgress()
    const screen = worldToScreen(target.tileX * TILE_SIZE, target.tileY * TILE_SIZE)

    ctx.fillStyle = 'black'
    ctx.fillRect(screen.x + 4, screen.y + 2, TILE_SIZE - 8, 6)

    ctx.fillStyle = 'lime'
    ctx.fillRect(screen.x + 4, screen.y + 2, (TILE_SIZE - 8) * progress, 6)
  }

  function drawInventoryDebug() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(10, 10, 250, 200)

    ctx.fillStyle = 'black'
    ctx.font = '16px sans-serif'

    let y = 30
    ctx.fillText('Inventory:', 20, y)
    y += 20

    if (inventory.length === 0) {
      ctx.fillText('(empty)', 20, y)
      y += 20
    } else {
      for (const stack of inventory) {
        ctx.fillText(`${stack.item}: ${stack.count}`, 20, y)
        y += 20
      }
    }

    y += 8
    ctx.fillText(`pos: ${Math.floor(player.x)}, ${Math.floor(player.y)}`, 20, y)
  }

  function drawBuildUi() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.fillRect(10, canvas.height - 74, 650, 64)

    ctx.fillStyle = 'white'
    ctx.font = '16px sans-serif'
    ctx.fillText(`Build: ${selectedBuild ?? 'none'}`, 20, canvas.height - 46)
    ctx.fillText(`Direction: ${buildDirection}`, 190, canvas.height - 46)
    ctx.fillText(
      '1=2x2 drill  2=chest  R=rotate  Right Click=place  F=fuel drill with coal/wood  M=map',
      20,
      canvas.height - 22,
    )
  }

  updateCamera(player.x + player.size / 2, player.y + player.size / 2, canvas.width, canvas.height)
  updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

  requestAnimationFrame(loop)
}