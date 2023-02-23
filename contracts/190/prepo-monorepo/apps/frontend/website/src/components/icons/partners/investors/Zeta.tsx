import { SVGProps } from 'react'

const Zeta: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="30" cy="30" r="30" fill="#0D1238" />
    <path d="M13 46V15H17.0289V25.2591H27.1011L13 45.9981V46Z" fill="url(#paint0_linear_15_54)" />
    <path d="M47.0337 15V46H43.0029V35.7409H32.9307L47.0337 15Z" fill="url(#paint1_linear_15_54)" />
    <defs>
      <linearGradient
        id="paint0_linear_15_54"
        x1="13"
        y1="25.6562"
        x2="20.75"
        y2="33.434"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFBFAB" />
        <stop offset="1" stopColor="#DE81BE" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_15_54"
        x1="43.139"
        y1="45.0313"
        x2="42.1737"
        y2="23.7184"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#A414F5" />
        <stop offset="1" stopColor="#D26DD3" />
      </linearGradient>
    </defs>
  </svg>
)

export default Zeta
