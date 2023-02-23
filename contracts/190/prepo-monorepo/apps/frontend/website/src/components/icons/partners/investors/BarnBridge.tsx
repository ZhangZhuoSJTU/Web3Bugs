import { SVGProps } from 'react'

const BarnBridge: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="30" cy="30" r="30" fill="white" />
    <path
      d="M30 26.9343H29.7887C25.9859 26.9343 22.8169 30.219 22.8169 34.3796V42.4818L29.7887 37.0073L36.7606 42.4818V34.3796C36.9718 30.219 33.8028 26.9343 30 26.9343Z"
      fill="#FF4339"
    />
    <path
      d="M0 0V60L18.0212 46.2044V30.438L14.841 27.5912L30.106 15.5474L45.371 27.5912L41.9788 30.219V45.9854L60 59.781V0H0Z"
      fill="#FF4339"
    />
  </svg>
)
export default BarnBridge
