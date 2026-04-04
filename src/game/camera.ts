export const camera = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }
  
  export function updateCamera(playerX: number, playerY: number, canvasWidth: number, canvasHeight: number) {
    camera.width = canvasWidth
    camera.height = canvasHeight
  
    camera.x = playerX - canvasWidth / 2
    camera.y = playerY - canvasHeight / 2
  }
  
  export function worldToScreen(worldX: number, worldY: number) {
    return {
      x: Math.floor(worldX - camera.x),
      y: Math.floor(worldY - camera.y),
    }
  }
  
  export function screenToWorld(screenX: number, screenY: number) {
    return {
      x: screenX + camera.x,
      y: screenY + camera.y,
    }
  }