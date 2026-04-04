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
  renderBuildings,
  updateBuildings,
  placeBurnerDrill,
  fuelBuildingAtTile,
  getBuildingAtTile,
} from './buildings'
import { mapState, renderMap, toggleMap } from './map'

let running = false

export function startGame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  if (running) return
  running = true

  setupInput()
  setupMouse(canvas)

  let selectedBuild: 'burner_drill' | null = null
  let last = performance.now()

  function loop(now: number) {
    const dt = (now - last) / 1000
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

      if (consumeRightPressed() && hovered && selectedBuild === 'burner_drill') {
        placeBurnerDrill(hovered.tileX, hovered.tileY)
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
    drawBuildings()
    drawPlayer()
    drawHover()
    drawMiningProgress()
    drawInventoryDebug()
    drawBuildUi()
  }

  function drawTerrain() {
    const bounds = getVisibleTileBounds()

    for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
      for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
        if (!isTileExplored(tileX, tileY)) {
          continue
        }

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
        if (!isTileExplored(tileX, tileY)) {
          continue
        }

        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)
        ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  function drawObjects() {
    const bounds = getVisibleTileBounds()

    for (let tileY = bounds.startTileY; tileY <= bounds.endTileY; tileY++) {
      for (let tileX = bounds.startTileX; tileX <= bounds.endTileX; tileX++) {
        if (!isTileExplored(tileX, tileY)) {
          continue
        }

        const tile = getTileAtWorldTile(tileX, tileY)
        const screen = worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE)

        if (tile.object?.type === 'tree') {
          ctx.fillStyle = 'green'
          ctx.fillRect(screen.x + 6, screen.y + 6, 20, 20)
        }

        if (tile.object?.type === 'ore') {
          ctx.fillStyle = 'gray'
          ctx.fillRect(screen.x + 6, screen.y + 6, 20, 20)
        }

        if (!isTileVisible(tileX, tileY)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
          ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  function drawBuildings() {
    renderBuildings(ctx)
  }

  function drawPlayer() {
    const screen = worldToScreen(player.x, player.y)

    ctx.fillStyle = 'blue'
    ctx.fillRect(screen.x, screen.y, player.size, player.size)
  }

  function drawHover() {
    const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
    if (!hovered || !isTileExplored(hovered.tileX, hovered.tileY)) {
      return
    }

    const screen = worldToScreen(hovered.tileX * TILE_SIZE, hovered.tileY * TILE_SIZE)

    ctx.strokeStyle = selectedBuild ? 'cyan' : 'yellow'
    ctx.lineWidth = 2
    ctx.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE)

    const building = getBuildingAtTile(hovered.tileX, hovered.tileY)
    if (building) {
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'
      ctx.fillText(`fuel: ${building.fuel.toFixed(1)} (F = add wood)`, screen.x, screen.y - 6)
    }
  }

  function drawMiningProgress() {
    const target = getMiningTarget()
    if (!target || !isTileExplored(target.tileX, target.tileY)) {
      return
    }

    const progress = getMiningProgress()
    const screen = worldToScreen(target.tileX * TILE_SIZE, target.tileY * TILE_SIZE)

    ctx.fillStyle = 'black'
    ctx.fillRect(screen.x + 4, screen.y + 2, TILE_SIZE - 8, 6)

    ctx.fillStyle = 'lime'
    ctx.fillRect(screen.x + 4, screen.y + 2, (TILE_SIZE - 8) * progress, 6)
  }

  function drawInventoryDebug() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(10, 10, 240, 180)

    ctx.fillStyle = 'black'
    ctx.font = '16px sans-serif'

    let y = 30
    ctx.fillText('Inventory:', 20, y)
    y += 20

    if (inventory.length === 0) {
      ctx.fillText('(empty)', 20, y)
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(10, canvas.height - 70, 420, 60)

    ctx.fillStyle = 'white'
    ctx.font = '16px sans-serif'
    ctx.fillText(`Build: ${selectedBuild ?? 'none'}`, 20, canvas.height - 42)
    ctx.fillText('1 = burner drill, Esc = clear, Right Click = place, F = fuel, M = map', 20, canvas.height - 20)
  }

  updateCamera(
    player.x + player.size / 2,
    player.y + player.size / 2,
    canvas.width,
    canvas.height,
  )
  updateVisibility(player.x + player.size / 2, player.y + player.size / 2, 10)

  requestAnimationFrame(loop)
}