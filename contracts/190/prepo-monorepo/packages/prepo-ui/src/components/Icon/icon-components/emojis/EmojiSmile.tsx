import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const EmojiSmile: React.FC<Props> = ({ width = '30', height = '30', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 61 61"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <g filter="url(#filter0_d_1752_3528)">
        <rect
          x="0"
          y="0"
          width="60"
          height="60"
          fill="url(#emoji_smile)"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_1752_3528"
          x="0"
          y="0.449707"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1752_3528" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_1752_3528"
            result="shape"
          />
        </filter>
        <pattern id="emoji_smile" patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref="#image0_1752_3528" transform="scale(0.00625)" />
        </pattern>
        <image
          id="image0_1752_3528"
          width="160"
          height="160"
          xlinkHref="data:image/png;base64,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"
        />
      </defs>
    </svg>
  )
}

export default EmojiSmile
