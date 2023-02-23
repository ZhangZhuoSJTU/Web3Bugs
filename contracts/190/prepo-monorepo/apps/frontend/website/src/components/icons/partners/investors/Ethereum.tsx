import { SVGProps } from 'react'

const Ethereum: React.FC<SVGProps<SVGSVGElement>> = (props) => (
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
      d="M30.2771 10L30.0088 10.9115V37.3602L30.2771 37.6279L42.5541 30.3709L30.2771 10Z"
      fill="#343434"
    />
    <path d="M30.2772 10L18 30.3709L30.2772 37.6279V24.7905V10Z" fill="#8C8C8C" />
    <path
      d="M30.2772 39.9523L30.126 40.1368V49.5582L30.2772 49.9997L42.5616 32.6991L30.2772 39.9523Z"
      fill="#3C3C3B"
    />
    <path d="M30.2772 49.9997V39.9523L18 32.6991L30.2772 49.9997Z" fill="#8C8C8C" />
    <path d="M30.2773 37.6279L42.5543 30.3709L30.2773 24.7905V37.6279Z" fill="#141414" />
    <path d="M18 30.3709L30.2772 37.6279V24.7905L18 30.3709Z" fill="#393939" />
  </svg>
)

export default Ethereum
