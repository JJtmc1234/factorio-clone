export const camera = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  zoom: 1,
}

const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const ZOOM_STEP = 1.1 // multiplicative per wheel notch

export function updateCamera(
  playerX: number,
  playerY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  camera.width = canvasWidth
  camera.height = canvasHeight

  // World-space size of the visible region depends on zoom — at 2x zoom we
  // see half as much world. Camera origin still tracks the player at the
  // center of the visible window.
  const visibleW = canvasWidth / camera.zoom
  const visibleH = canvasHeight / camera.zoom
  camera.x = playerX - visibleW / 2
  camera.y = playerY - visibleH / 2
}

export function adjustZoom(wheelDelta: number) {
  // Wheel-down (positive deltaY) = zoom out (Factorio convention).
  const factor = wheelDelta > 0 ? 1 / ZOOM_STEP : ZOOM_STEP
  camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * factor))
}

// World drawing happens inside applyWorldTransform / restoreWorldTransform,
// so the canvas itself is already scaled+translated. worldToScreen therefore
// returns world coords *relative to the camera* — when drawn in the
// transformed ctx they end up in the right place. (The Math.floor keeps
// pixel-snapped output at zoom=1; at other zooms we accept sub-pixel.)
export function worldToScreen(worldX: number, worldY: number) {
  return {
    x: Math.floor(worldX - camera.x),
    y: Math.floor(worldY - camera.y),
  }
}

// Mouse coordinates are in raw canvas pixels — divide by zoom and add the
// camera offset to recover world coords.
export function screenToWorld(screenX: number, screenY: number) {
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y,
  }
}

export function applyWorldTransform(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.scale(camera.zoom, camera.zoom)
}

export function restoreWorldTransform(ctx: CanvasRenderingContext2D) {
  ctx.restore()
}