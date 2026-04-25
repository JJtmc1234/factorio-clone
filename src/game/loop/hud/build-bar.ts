import { state } from '../state'

export function drawBuildUi(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const barHeight = 78
  const barY = canvas.height - barHeight - 10
  const barWidth = Math.min(canvas.width - 20, 1000)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(10, barY, barWidth, barHeight)

  ctx.fillStyle = 'white'
  ctx.font = '16px sans-serif'
  ctx.fillText(`Build: ${state.selectedBuild ?? 'none'}`, 20, barY + 28)
  ctx.fillText(`Direction: ${state.buildDirection}`, 200, barY + 28)
  ctx.fillText(
    `Open: ${state.openedBuilding ? state.openedBuilding.type : 'none'}`,
    360,
    barY + 28,
  )
  ctx.font = '13px sans-serif'
  ctx.fillText(
    '1=drill  2=chest  3=belt  4=furnace  5=inserter  R=rotate  Right-Click=place  E=open  G=take  F=fuel/store coal  X=deconstruct  Tab/I=inventory  M=map',
    20,
    barY + 56,
  )
}
