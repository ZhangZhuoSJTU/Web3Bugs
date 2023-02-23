import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const EmojiHappy: React.FC<Props> = ({ width = '30', height = '30', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 61 61"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <g filter="url(#filter0_d_2438_2)">
        <rect
          x="0"
          y="0"
          width="60"
          height="60"
          fill="url(#emoji_happy)"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_2438_2"
          x="0.124756"
          y="0.3396"
          width="60.1321"
          height="60.1321"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="8" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 0.8 0 0 0 0 0.301961 0 0 0 0.31 0"
          />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2438_2" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_2438_2"
            result="shape"
          />
        </filter>
        <pattern id="emoji_happy" patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref="#image0_2438_2" transform="scale(0.00625)" />
        </pattern>
        <image
          id="image0_2438_2"
          width="160"
          height="160"
          xlinkHref="data:image/png;base64,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"
        />
      </defs>
    </svg>
  )
}

export default EmojiHappy
