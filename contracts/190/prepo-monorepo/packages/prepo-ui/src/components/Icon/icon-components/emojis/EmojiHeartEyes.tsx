import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const EmojiHeartEyes: React.FC<Props> = ({ width = '30', height = '30', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 61 61"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <g filter="url(#filter0_d_1752_3535)">
        <rect
          x="0"
          y="0"
          width="60"
          height="60"
          fill="url(#emoji_heart_eyes)"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_1752_3535"
          x="0.109131"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1752_3535" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_1752_3535"
            result="shape"
          />
        </filter>
        <pattern id="emoji_heart_eyes" patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref="#image0_1752_3535" transform="scale(0.00625)" />
        </pattern>
        <image
          id="image0_1752_3535"
          width="160"
          height="160"
          xlinkHref="data:image/png;base64,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"
        />
      </defs>
    </svg>
  )
}

export default EmojiHeartEyes
