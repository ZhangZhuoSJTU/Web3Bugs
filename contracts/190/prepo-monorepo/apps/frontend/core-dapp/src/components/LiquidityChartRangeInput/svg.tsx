export const brushHandlePath = (height: number): string =>
  [
    // handle
    `M 0 0`, // move to origin
    `v ${height}`, // vertical line
    'm 1 0', // move 1px to the right
    `V 0`, // second vertical line
    `M 0 1`, // move to origin

    // head
    'h 12', // horizontal line
    'q 2 0, 2 2', // rounded corner
    'v 22', // vertical line
    'q 0 2 -2 2', // rounded corner
    'h -12', // horizontal line
    `z`, // close path
  ].join(' ')

export const brushHandleAccentPath = (): string =>
  [
    'm 5 7', // move to first accent
    'v 14', // vertical line
    'M 0 0', // move to origin
    'm 9 7', // move to second accent
    'v 14', // vertical line
    'z',
  ].join(' ')

type OffScreenHandleProps = {
  color: string
  size?: number
  margin?: number
}

export const OffScreenHandle: React.FC<OffScreenHandleProps> = ({
  color,
  size = 10,
  margin = 10,
}) => (
  <polygon
    points={`0 0, ${size} ${size}, 0 ${size}`}
    transform={` translate(${size + margin}, ${margin}) rotate(45) `}
    fill={color}
    stroke={color}
    strokeWidth="4"
    strokeLinejoin="round"
  />
)
