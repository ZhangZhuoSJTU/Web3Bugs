import { FC, SVGProps } from 'react'

export const BubbleIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="283"
    height="283"
    viewBox="0 0 283 283"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle
      cx="1"
      cy="1"
      r="141.422"
      transform="matrix(1 0 0 -1 140.422 142.422)"
      fill="url(#paint0_radial_306_36)"
    />
    <path
      d="M222.802 82.9356C211.539 96.6782 172.068 51.227 187.288 42.3486C214.558 30.2995 232.575 71.0115 222.802 82.9356Z"
      fill="white"
    />
    <path
      d="M241.423 96.8215C249.421 98.0212 250.821 112.217 241.423 114.816C235.025 111.617 233.026 96.8215 241.423 96.8215Z"
      fill="white"
    />
    <defs>
      <radialGradient id="paint0_radial_306_36">
        <stop offset="10%" stopColor="#9C93FF" />
        <stop offset="95%" stopColor="#6264D9" />
      </radialGradient>
    </defs>
  </svg>
)
