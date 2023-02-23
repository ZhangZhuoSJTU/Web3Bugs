export const OVERFLOW_MARGIN = 20
export const HEIGHT = 248 + OVERFLOW_MARGIN
export const WIDTH = 477.44 + OVERFLOW_MARGIN
export const SCALE = 0.9
export const AXIS_LINES_START = { x: 48, y: 27 }
export const AXIS_LINES_SIZE = { x: 349 * SCALE, y: 191 * SCALE }
export const AXIS_LINES_END = {
  x: AXIS_LINES_START.x + AXIS_LINES_SIZE.x,
  y: AXIS_LINES_START.y + AXIS_LINES_SIZE.y,
}
export const NIB_UNIT = 4 * SCALE
export const LITTLE_CIRCLE_RADIUS = 5 * SCALE
export const MAIN_RECT_SIZE = { x: 51.5 * SCALE, y: 28 * SCALE }
export const MAIN_RECT_RADIUS = 8
export const INNER_RECT_START = { x: AXIS_LINES_START.x + 30, y: AXIS_LINES_START.y + 10 }
export const INNER_RECT_SIZE = { x: 284 * SCALE }
export const LIMITS_RECT_SIZE_DEFAULT = { x: 40 * SCALE, y: 20.5 * SCALE }
