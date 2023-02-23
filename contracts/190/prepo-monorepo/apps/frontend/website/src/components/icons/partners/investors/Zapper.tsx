import { SVGProps } from 'react'

const Zapper: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M60 30C60 13.4315 46.5685 0 30 0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60C46.5685 60 60 46.5685 60 30Z"
      fill="#784FFE"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.5205 22.5443L39.6725 22.44L34.6084 30.072L46.5599 30.0142L41.495 37.5182L20.2058 37.6544L25.3499 30.076L13.4399 30.0714L18.5205 22.5443Z"
      fill="white"
    />
  </svg>
)

export default Zapper
