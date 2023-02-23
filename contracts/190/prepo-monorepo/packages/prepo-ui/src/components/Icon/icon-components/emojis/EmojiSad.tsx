import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const EmojiSadFace: React.FC<Props> = ({ width = '30', height = '30', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 61 61"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <g filter="url(#filter0_d_2438_52)">
        <rect
          x="0"
          y="0"
          width="60"
          height="60"
          fill="url(#emoji_sad)"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_2438_52"
          x="0"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2438_52" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_2438_52"
            result="shape"
          />
        </filter>
        <pattern id="emoji_sad" patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref="#image0_2438_52" transform="scale(0.00625)" />
        </pattern>
        <image
          id="image0_2438_52"
          width="160"
          height="160"
          xlinkHref="data:image/png;base64,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"
        />
      </defs>
    </svg>
  )
}

export default EmojiSadFace
