import {
  HEIGHT,
  WIDTH,
  AXIS_LINES_START,
  AXIS_LINES_END,
  AXIS_LINES_SIZE,
  NIB_UNIT,
  LITTLE_CIRCLE_RADIUS,
  MAIN_RECT_SIZE,
  MAIN_RECT_RADIUS,
  INNER_RECT_SIZE,
  INNER_RECT_START,
  LIMITS_RECT_SIZE_DEFAULT,
  SCALE,
} from './market-visualisation-constants'
import { Bounds } from '../../position/markets'
import { formatValuationNumber } from '../../../helpers'

type Coord = { x: number; y: number }

type InnerRect = {
  start: Coord
  size: Coord
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawAxisLines(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(AXIS_LINES_START.x, AXIS_LINES_START.y)
  ctx.lineTo(AXIS_LINES_START.x, AXIS_LINES_END.y)
  ctx.lineTo(AXIS_LINES_END.x, AXIS_LINES_END.y)
  ctx.stroke()
}

export function drawInnerRect(ctx: CanvasRenderingContext2D, payoutRange: Bounds): InnerRect {
  const { floor, ceil } = payoutRange

  const start = { x: INNER_RECT_START.x, y: AXIS_LINES_START.y + AXIS_LINES_SIZE.y * (1 - ceil) }
  const size = { x: INNER_RECT_SIZE.x, y: AXIS_LINES_SIZE.y * (ceil - floor) }

  ctx.strokeStyle = '#707070'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(start.x, start.y, size.x, size.y)
  ctx.stroke()
  return { start, size }
}

export function drawMainLine(ctx: CanvasRenderingContext2D, innerRect: InnerRect): void {
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(AXIS_LINES_START.x, innerRect.start.y + innerRect.size.y)
  // Move to bottom left of inner rect
  ctx.lineTo(INNER_RECT_START.x, innerRect.start.y + innerRect.size.y)
  // Move to top right of inner rect
  ctx.lineTo(INNER_RECT_START.x + innerRect.size.x, innerRect.start.y)
  // Extend line 31px right
  ctx.lineTo(INNER_RECT_START.x + innerRect.size.x + 31, innerRect.start.y)
  ctx.stroke()
}

export function drawNibs(
  ctx: CanvasRenderingContext2D,
  innerRect: InnerRect,
  entryIntercept: Coord,
  exitIntercept: Coord
): void {
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 2
  ctx.beginPath()
  // Draw nib at bottom left of left axis
  ctx.moveTo(AXIS_LINES_START.x + NIB_UNIT, innerRect.start.y + innerRect.size.y)
  ctx.lineTo(AXIS_LINES_START.x - NIB_UNIT, innerRect.start.y + innerRect.size.y)
  ctx.stroke()
  // Draw entry % nib
  ctx.moveTo(AXIS_LINES_START.x + NIB_UNIT, entryIntercept.y)
  ctx.lineTo(AXIS_LINES_START.x - NIB_UNIT, entryIntercept.y)
  ctx.stroke()
  // Draw exit % nib
  ctx.moveTo(AXIS_LINES_START.x + NIB_UNIT, exitIntercept.y)
  ctx.lineTo(AXIS_LINES_START.x - NIB_UNIT, exitIntercept.y)
  ctx.stroke()
  // Draw exit val nib
  ctx.moveTo(exitIntercept.x, AXIS_LINES_END.y - NIB_UNIT)
  ctx.lineTo(exitIntercept.x, AXIS_LINES_END.y + NIB_UNIT)
  ctx.stroke()
  // Draw entry val nib
  ctx.moveTo(entryIntercept.x, AXIS_LINES_END.y - NIB_UNIT)
  ctx.lineTo(entryIntercept.x, AXIS_LINES_END.y + NIB_UNIT)
  ctx.stroke()
}

export function getIntercept(val: number, payoutRange: Bounds, innerRect: InnerRect): Coord {
  const xMultiplier = (val - payoutRange.floor) / (payoutRange.ceil - payoutRange.floor)
  const x = xMultiplier * innerRect.size.x + innerRect.start.x
  const y = AXIS_LINES_START.y + AXIS_LINES_SIZE.y * (1 - val)
  return { x, y }
}

export function drawEntryLines(ctx: CanvasRenderingContext2D, entryIntercept: Coord): void {
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.setLineDash([7, 10])
  ctx.moveTo(AXIS_LINES_START.x, entryIntercept.y)
  ctx.lineTo(entryIntercept.x, entryIntercept.y)
  ctx.lineTo(entryIntercept.x, AXIS_LINES_END.y)
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawEntryExitBubbles(
  ctx: CanvasRenderingContext2D,
  entryIntercept: Coord,
  exitIntercept: Coord,
  positionColor: string
): void {
  ctx.lineWidth = 2

  // Draw inner exit circle
  ctx.strokeStyle = 'white'
  ctx.fillStyle = positionColor
  ctx.beginPath()
  ctx.arc(exitIntercept.x, exitIntercept.y, LITTLE_CIRCLE_RADIUS, 0, 2 * Math.PI)
  ctx.fill()
  ctx.stroke()

  // Draw main exit rect
  ctx.fillStyle = positionColor
  roundedRect(
    ctx,
    exitIntercept.x - MAIN_RECT_SIZE.x / 2,
    exitIntercept.y - MAIN_RECT_SIZE.y - LITTLE_CIRCLE_RADIUS,
    MAIN_RECT_SIZE.x,
    MAIN_RECT_SIZE.y,
    MAIN_RECT_RADIUS
  )
  ctx.fill()
  // Draw exit text
  ctx.fillStyle = 'white'
  ctx.font = `bold ${16 * SCALE}px Nunito`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    'Exit',
    exitIntercept.x,
    MAIN_RECT_SIZE.y / 2 + exitIntercept.y - MAIN_RECT_SIZE.y - LITTLE_CIRCLE_RADIUS
  )

  // Draw inner entry circle
  ctx.strokeStyle = 'white'
  ctx.fillStyle = 'black'
  ctx.beginPath()
  ctx.arc(entryIntercept.x, entryIntercept.y, LITTLE_CIRCLE_RADIUS, 0, 2 * Math.PI)
  ctx.fill()
  ctx.stroke()

  // Draw main entry rect
  ctx.fillStyle = 'black'
  roundedRect(
    ctx,
    entryIntercept.x - MAIN_RECT_SIZE.x / 2,
    entryIntercept.y - MAIN_RECT_SIZE.y - LITTLE_CIRCLE_RADIUS,
    MAIN_RECT_SIZE.x,
    MAIN_RECT_SIZE.y,
    MAIN_RECT_RADIUS
  )
  ctx.fill()

  // Draw entry text
  ctx.fillStyle = 'white'
  ctx.font = `bold ${16 * SCALE}px Nunito`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    'Entry',
    entryIntercept.x,
    MAIN_RECT_SIZE.y / 2 + entryIntercept.y - MAIN_RECT_SIZE.y - LITTLE_CIRCLE_RADIUS
  )
}

export function drawExitLines(
  ctx: CanvasRenderingContext2D,
  exitIntercept: Coord,
  positionColor: string
): void {
  ctx.strokeStyle = positionColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.setLineDash([7, 10])
  ctx.moveTo(AXIS_LINES_START.x, exitIntercept.y)
  ctx.lineTo(exitIntercept.x, exitIntercept.y)
  ctx.lineTo(exitIntercept.x, AXIS_LINES_END.y)
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawYAxisLabels(
  ctx: CanvasRenderingContext2D,
  entry: number,
  exit: number,
  positionColor: string,
  entryIntercept: Coord,
  exitIntercept: Coord
): void {
  ctx.font = `bold ${18 * SCALE}px Nunito`
  ctx.textAlign = 'start'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = positionColor
  ctx.fillText(`${(exit * 100).toFixed(0)}%`, 0, exitIntercept.y)
  ctx.fillStyle = 'black'
  ctx.fillText(`${(entry * 100).toFixed(0)}%`, 0, entryIntercept.y)
}

export function drawXAxisLabels(
  ctx: CanvasRenderingContext2D,
  entryVal: number,
  exitVal: number,
  entryIntercept: Coord,
  exitIntercept: Coord,
  positionColor: string
): void {
  ctx.font = `bold ${18 * SCALE}px Nunito`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  // Exit val
  ctx.fillStyle = positionColor
  ctx.fillText(`${formatValuationNumber(exitVal)}`, exitIntercept.x, AXIS_LINES_END.y + 10 * SCALE)
  // Entry val
  ctx.fillStyle = 'black'
  ctx.fillText(
    `${formatValuationNumber(entryVal)}`,
    entryIntercept.x,
    AXIS_LINES_END.y + 10 * SCALE
  )
}

export function drawAxisLabels(ctx: CanvasRenderingContext2D): void {
  // Draw y axis label (payout)
  ctx.font = `bold ${16 * SCALE}px Nunito`
  ctx.fillStyle = '#707070'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'ideographic'
  ctx.fillText('Payout', AXIS_LINES_START.x, AXIS_LINES_START.y - 4 * SCALE)
  // Draw y axis label (valuation)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'middle'
  ctx.fillText('Valuation', AXIS_LINES_START.x + AXIS_LINES_SIZE.x + 4 * SCALE, AXIS_LINES_END.y)
}

export function drawColorOverlay(
  ctx: CanvasRenderingContext2D,
  entryIntercept: Coord,
  exitIntercept: Coord,
  innerRect: InnerRect,
  positionColor: string
): void {
  ctx.globalAlpha = 0.12
  ctx.fillStyle = positionColor
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(innerRect.start.x, entryIntercept.y)
  ctx.lineTo(entryIntercept.x, entryIntercept.y)
  ctx.lineTo(entryIntercept.x, innerRect.start.y + innerRect.size.y)
  ctx.lineTo(exitIntercept.x, innerRect.start.y + innerRect.size.y)
  ctx.lineTo(exitIntercept.x, exitIntercept.y)
  ctx.lineTo(innerRect.start.x, exitIntercept.y)
  ctx.closePath()
  ctx.fill()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

export function drawLimits(
  ctx: CanvasRenderingContext2D,
  payoutRange: Bounds,
  valuationRange: Bounds,
  innerRect: InnerRect
): void {
  ctx.font = `${15 * SCALE}px Nunito`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // payout range ceil
  ctx.fillStyle = '#FFFFFF'
  const payoutCeilStart = {
    x: innerRect.start.x + innerRect.size.x / 2 - LIMITS_RECT_SIZE_DEFAULT.x / 2,
    y: innerRect.start.y - LIMITS_RECT_SIZE_DEFAULT.y / 2,
  }
  ctx.fillRect(
    payoutCeilStart.x,
    payoutCeilStart.y,
    LIMITS_RECT_SIZE_DEFAULT.x,
    LIMITS_RECT_SIZE_DEFAULT.y
  )
  ctx.fillStyle = '#A0A0A0'
  ctx.fillText(
    `${(payoutRange.ceil * 100).toFixed(0)}%`,
    payoutCeilStart.x + LIMITS_RECT_SIZE_DEFAULT.x / 2,
    payoutCeilStart.y + LIMITS_RECT_SIZE_DEFAULT.y / 2
  )
  // payout range floor
  ctx.fillStyle = '#FFFFFF'
  const payoutFloorStart = {
    x: innerRect.start.x + innerRect.size.x / 2 - LIMITS_RECT_SIZE_DEFAULT.x / 2,
    y: innerRect.start.y + innerRect.size.y - LIMITS_RECT_SIZE_DEFAULT.y / 2,
  }
  ctx.fillRect(
    payoutFloorStart.x,
    payoutFloorStart.y,
    LIMITS_RECT_SIZE_DEFAULT.x,
    LIMITS_RECT_SIZE_DEFAULT.y
  )
  ctx.fillStyle = '#A0A0A0'
  ctx.fillText(
    `${(payoutRange.floor * 100).toFixed(0)}%`,
    payoutFloorStart.x + LIMITS_RECT_SIZE_DEFAULT.x / 2,
    payoutFloorStart.y + LIMITS_RECT_SIZE_DEFAULT.y / 2
  )

  // valuation range ceil
  const valuationCeilRectWidth =
    valuationRange.ceil >= 100
      ? LIMITS_RECT_SIZE_DEFAULT.x + 12 * SCALE
      : LIMITS_RECT_SIZE_DEFAULT.x * SCALE
  ctx.fillStyle = '#FFFFFF'
  const valuationCeilStart = {
    x: innerRect.start.x + innerRect.size.x - valuationCeilRectWidth / 2,
    y: innerRect.start.y + innerRect.size.y / 2 - LIMITS_RECT_SIZE_DEFAULT.y / 2,
  }
  ctx.fillRect(
    valuationCeilStart.x,
    valuationCeilStart.y,
    valuationCeilRectWidth,
    LIMITS_RECT_SIZE_DEFAULT.y
  )
  ctx.fillStyle = '#A0A0A0'
  ctx.fillText(
    `${formatValuationNumber(valuationRange.ceil)}`,
    valuationCeilStart.x + valuationCeilRectWidth / 2,
    valuationCeilStart.y + LIMITS_RECT_SIZE_DEFAULT.y / 2
  )

  // valuation range floor
  const valuationFloorRectWidth =
    valuationRange.floor >= 100
      ? LIMITS_RECT_SIZE_DEFAULT.x + 12 * SCALE
      : LIMITS_RECT_SIZE_DEFAULT.x * SCALE
  ctx.fillStyle = '#FFFFFF'
  const valuationFloorStart = {
    x: innerRect.start.x - valuationFloorRectWidth / 2,
    y: innerRect.start.y + innerRect.size.y / 2 - LIMITS_RECT_SIZE_DEFAULT.y / 2,
  }
  ctx.fillRect(
    valuationFloorStart.x,
    valuationFloorStart.y,
    valuationFloorRectWidth,
    LIMITS_RECT_SIZE_DEFAULT.y
  )
  ctx.fillStyle = '#A0A0A0'
  ctx.fillText(
    `${formatValuationNumber(valuationRange.floor)}`,
    valuationFloorStart.x + valuationFloorRectWidth / 2,
    valuationFloorStart.y + LIMITS_RECT_SIZE_DEFAULT.y / 2
  )
}

export function draw(
  canvas: HTMLCanvasElement,
  entryValuation: number,
  exitValuation: number,
  entryPercent: number,
  exitPercent: number,
  payoutRange: Bounds,
  valuationRange: Bounds,
  positionInProfit: boolean,
  validPosition: boolean
): void {
  // Set up canvas
  const ratio = window.devicePixelRatio || 2
  canvas.width = WIDTH * SCALE * ratio
  canvas.height = HEIGHT * SCALE * ratio
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  // Make canvas correctly scale down on mobile widths
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.maxHeight = `${HEIGHT * SCALE}px`
  canvas.style.maxWidth = `${WIDTH * SCALE}px`

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const positionColor = positionInProfit ? '#0E992F' : '#D5141B'

  const innerRect = drawInnerRect(ctx, payoutRange)
  const entryIntercept = getIntercept(entryPercent, payoutRange, innerRect)
  const exitIntercept = getIntercept(exitPercent, payoutRange, innerRect)
  drawAxisLabels(ctx)
  drawAxisLines(ctx)
  drawMainLine(ctx, innerRect)
  if (!validPosition) return
  drawColorOverlay(ctx, entryIntercept, exitIntercept, innerRect, positionColor)
  drawYAxisLabels(ctx, entryPercent, exitPercent, positionColor, entryIntercept, exitIntercept)
  drawXAxisLabels(ctx, entryValuation, exitValuation, entryIntercept, exitIntercept, positionColor)
  drawNibs(ctx, innerRect, entryIntercept, exitIntercept)
  drawEntryLines(ctx, entryIntercept)
  drawExitLines(ctx, exitIntercept, positionColor)
  drawLimits(ctx, payoutRange, valuationRange, innerRect)
  drawEntryExitBubbles(ctx, entryIntercept, exitIntercept, positionColor)
}
