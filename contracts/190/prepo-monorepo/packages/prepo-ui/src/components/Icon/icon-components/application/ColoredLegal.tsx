import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const ColoredLegal: React.FC<Props> = ({ width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 21 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.6504 0.711426L9.79688 2.56494L5.64453 6.71533C5.64285 6.71702 5.64229 6.71949 5.64062 6.72119L3.82031 8.5415L5.23438 9.95557L6.35352 8.83643L8.26758 10.7505L0.462891 18.5552L1.87695 19.9692L9.68164 12.1646L11.7656 14.2505L10.6094 15.4087L12.0234 16.8228L13.8867 14.9575L18.0391 10.8071L20.0527 8.79346L18.6367 7.37939L17.332 8.68604L11.918 3.27197L13.0645 2.12549L11.6504 0.711426ZM11.3418 18.2622V20.2622H20.3418V18.2622H11.3418Z"
      fill="url(#paint0_linear_5305_4855)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_5305_4855"
        x1="-0.0593518"
        y1="0.711426"
        x2="-0.0593518"
        y2="21.2895"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FBC2EB" />
        <stop offset="1" stopColor="#A18CD1" />
      </linearGradient>
    </defs>
  </svg>
)

export default ColoredLegal
