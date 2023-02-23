import { SVGProps } from 'react'

const Gelato: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="30" cy="30" r="30" fill="url(#paint0_linear_14_44)" />
    <path
      d="M40.2641 21.9703C40.2609 22.5141 39.7605 22.8987 39.2197 22.8418C37.8789 22.7008 36.6505 22.7125 35.502 22.8321C33.0023 23.0923 30.925 23.8628 29.0097 24.5731L29.0056 24.5747C28.8896 24.6177 28.7743 24.6604 28.6596 24.7028C26.626 25.4544 24.7521 26.1009 22.5288 26.1522C21.6419 26.1727 20.6865 26.0982 19.6343 25.8867C18.7319 25.7053 18.011 25.0169 17.8322 24.114C17.6905 23.3986 17.6162 22.6588 17.6162 21.9018C17.6162 15.6477 22.6861 10.5778 28.9403 10.5778C35.1943 10.5778 40.2643 15.6477 40.2643 21.9018C40.2643 21.9246 40.2642 21.9474 40.2641 21.9703Z"
      fill="url(#paint1_radial_14_44)"
    />
    <path
      opacity="0.7"
      d="M18.6237 27.597C17.7733 27.3927 16.9973 28.3064 17.4161 29.0742L28.5315 49.4524C28.7103 49.7803 29.1811 49.7803 29.3599 49.4524L41.6284 26.9602C42.0636 26.1625 41.6449 25.1632 40.7538 24.9851C38.8151 24.5979 37.1634 24.5562 35.6932 24.7093C33.4376 24.9441 31.5642 25.6381 29.6194 26.3585C29.5163 26.3967 29.4131 26.4349 29.3096 26.4731C27.2737 27.2256 25.1369 27.9798 22.5681 28.0391C21.3472 28.0672 20.0467 27.9388 18.6237 27.597Z"
      fill="url(#paint2_linear_14_44)"
    />
    <path
      d="M28.9402 27.0026C28.9402 26.7662 29.0878 26.5551 29.3095 26.4731C29.413 26.4349 29.5162 26.3967 29.6193 26.3585C31.5641 25.6381 33.4375 24.9441 35.6931 24.7093C37.1633 24.5562 38.8151 24.5979 40.7537 24.9851C41.6448 25.1632 42.0634 26.1625 41.6283 26.9602L29.3598 49.4524C29.2694 49.6182 29.1044 49.7001 28.9402 49.6983V27.0026Z"
      fill="url(#paint3_linear_14_44)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_14_44"
        x1="30"
        y1="0"
        x2="30"
        y2="60"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFE2AE" />
        <stop offset="1" stopColor="#FFB0A9" />
      </linearGradient>
      <radialGradient
        id="paint1_radial_14_44"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(35.8059 13.8806) rotate(167.3) scale(43.451 52.0613)"
      >
        <stop />
        <stop offset="0.116813" stopColor="#1C0008" />
        <stop offset="1" stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id="paint2_linear_14_44"
        x1="29.5504"
        y1="25.2239"
        x2="29.5504"
        y2="49.6983"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#1B0008" />
        <stop offset="1" stopColor="#1B0008" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient
        id="paint3_linear_14_44"
        x1="35.3709"
        y1="24.6266"
        x2="35.3709"
        y2="60.1493"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#150006" />
        <stop offset="1" stopColor="#1B0008" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
)

export default Gelato
