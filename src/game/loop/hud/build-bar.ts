import { getBuildingInventoryCount } from '../../buildings'
import { state } from '../state'

export function drawBuildUi(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const barHeight = 78
  const barY = canvas.height - barHeight - 10
  const barWidth = Math.min(canvas.width - 20, 1000)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(10, barY, barWidth, barHeight)

  ctx.fillStyle = 'white'
  ctx.font = '16px sans-serif'

  const buildLabel = state.selectedBuild
    ? `${state.selectedBuild} ×${getBuildingInventoryCount(state.selectedBuild)}`
    : 'none'
  ctx.fillText(`Build: ${buildLabel}`, 20, barY + 28)
  ctx.fillText(`Direction: ${state.buildDirection}`, 280, barY + 28)
  ctx.fillText(
    `Open: ${state.openedBuilding ? state.openedBuilding.type : 'none'}`,
    440,
    barY + 28,
  )
  ctx.font = '13px sans-serif'
  ctx.fillText(
    '1=drill  2=wooden  3=belt  4=furnace  5=inserter  6=iron  R=rotate  RClick=place  E=inv/open  G=take  F=fuel  X=deconstruct  M=map',
    20,
    barY + 56,
  )
}
