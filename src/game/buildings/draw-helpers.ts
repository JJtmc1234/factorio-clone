import type { Direction } from './types'

export function drawDirectionMarker(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  direction: Direction,
  size: number,
  color = '#ffd54f',
) {
  ctx.fillStyle = color

  if (direction === 'up') ctx.fillRect(screenX + size / 2 - 8, screenY + 4, 16, 6)
  else if (direction === 'right')
    ctx.fillRect(screenX + size - 10, screenY + size / 2 - 8, 6, 16)
  else if (direction === 'down')
    ctx.fillRect(screenX + size / 2 - 8, screenY + size - 10, 16, 6)
  else ctx.fillRect(screenX + 4, screenY + size / 2 - 8, 6, 16)
}

export function drawSpriteRotated(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(rotation)
  ctx.drawImage(image, -width / 2, -height / 2, width, height)
  ctx.restore()
}
