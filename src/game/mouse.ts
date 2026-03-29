export const mouse = {
    x: 0,
    y: 0,
    leftDown: false
  }
  
  export function setupMouse(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    })
  
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        mouse.leftDown = true
      }
    })
  
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        mouse.leftDown = false
      }
    })
  }