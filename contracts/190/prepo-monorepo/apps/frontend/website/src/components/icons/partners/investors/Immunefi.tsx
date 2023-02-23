import { SVGProps } from 'react'

const Immunefi: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="30" cy="30" r="30" fill="#05082B" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.949 27.5133L30.0367 38.8L41.006 27.6338L49.9999 36.7891L39.5501 47.4265L36.8619 44.7629L44.695 36.7891L41.006 33.0338L30.0367 44.2001L18.949 32.9134L15.3048 36.6229L23.2571 44.718L20.5689 47.3815L10 36.6229L18.949 27.5133Z"
      fill="white"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M41.0511 32.9131L29.9634 21.6265L18.9942 32.7927L10.0002 23.6373L20.45 13L23.1382 15.6636L15.3051 23.6373L18.9942 27.3926L29.9634 16.2264L41.0511 27.5131L44.6953 23.8035L36.743 15.7085L39.4312 13.0449L50.0001 23.8035L41.0511 32.9131Z"
      fill="white"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M28.3081 47.1613V40.0503H31.9288V47.1613H28.3081Z"
      fill="white"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M28.3081 20.3762V13.2652H31.9288V20.3762H28.3081Z"
      fill="white"
    />
  </svg>
)

export default Immunefi
