export const mouse = {
    x: 0,
    y: 0
}
  
export function setupMouse(canvas: HTMLCanvasElement) {
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
})
}