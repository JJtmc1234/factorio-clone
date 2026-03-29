export function startGame(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) {
    let last = performance.now()
  
    function loop(now: number) {
      const dt = (now - last) / 1000
      last = now
  
      update(dt)
      render()
  
      requestAnimationFrame(loop)
    }
  
    function update(_dt: number) {
      // later: movement, mining, world updates
    }
  
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
  
      ctx.fillStyle = 'blue'
      ctx.fillRect(100, 100, 24, 24)
    }
  
    requestAnimationFrame(loop)
  }