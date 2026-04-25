import { getGameSprite } from '../../components/gameSprites'
import { worldToScreen } from '../camera'
import { player } from '../player'

export function drawPlayer(ctx: CanvasRenderingContext2D) {
  const screen = worldToScreen(player.x, player.y)
  const sprite = getGameSprite('player')

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, screen.x - 12, screen.y - 24, 48, 48)
    return
  }

  drawFallbackPlayerSprite(ctx, screen.x, screen.y)
}

function drawFallbackPlayerSprite(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
) {
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
  } else if (player.facing === 'up') {
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
