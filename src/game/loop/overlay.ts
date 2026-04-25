import { worldToScreen } from '../camera'
import { mouse } from '../mouse'
import { TILE_SIZE, getTileAtScreenPosition } from '../world'
import {
  canPlaceBuilding,
  getBuildingAtTile,
  getBuildingTooltipLines,
  renderBuildingGhost,
} from '../buildings'
import { getMiningProgress, getMiningTarget } from '../mining'
import { state } from './state'

export function drawHoverAndGhost(ctx: CanvasRenderingContext2D) {
  const hovered = getTileAtScreenPosition(mouse.x, mouse.y)
  if (!hovered) return

  const screen = worldToScreen(hovered.tileX * TILE_SIZE, hovered.tileY * TILE_SIZE)

  if (state.selectedBuild) {
    const valid = canPlaceBuilding(state.selectedBuild, hovered.tileX, hovered.tileY)
    renderBuildingGhost(
      ctx,
      state.selectedBuild,
      hovered.tileX,
      hovered.tileY,
      state.buildDirection,
      valid,
    )
  } else {
    ctx.strokeStyle = 'yellow'
    ctx.lineWidth = 2
    ctx.strokeRect(screen.x + 1, screen.y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
  }

  const building = getBuildingAtTile(hovered.tileX, hovered.tileY)
  if (!building) return

  const lines = getBuildingTooltipLines(building)
  const boxWidth = 260
  const boxHeight = 10 + lines.length * 15

  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
  ctx.fillRect(screen.x, screen.y - boxHeight - 4, boxWidth, boxHeight)

  ctx.fillStyle = 'white'
  ctx.font = '12px sans-serif'

  lines.forEach((line, index) => {
    ctx.fillText(line, screen.x + 5, screen.y - boxHeight + 12 + index * 15)
  })
}

export function drawMiningProgress(ctx: CanvasRenderingContext2D) {
  const target = getMiningTarget()
  if (!target) return

  const progress = getMiningProgress()
  const screen = worldToScreen(target.tileX * TILE_SIZE, target.tileY * TILE_SIZE)

  ctx.fillStyle = 'black'
  ctx.fillRect(screen.x + 4, screen.y + 2, TILE_SIZE - 8, 6)

  ctx.fillStyle = 'lime'
  ctx.fillRect(screen.x + 4, screen.y + 2, (TILE_SIZE - 8) * progress, 6)
}
