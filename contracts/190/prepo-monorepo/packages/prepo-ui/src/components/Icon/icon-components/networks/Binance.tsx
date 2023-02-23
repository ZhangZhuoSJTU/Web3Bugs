import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const Binance: React.FC<Props> = ({ width = '40', height = '39' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 40 39"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="38.8939" height="38.8939" transform="translate(0.523438 0.0927734)" fill="white" />
    <path
      d="M14.3067 17.5004L19.9721 11.8373L25.6399 17.505L28.9345 14.2081L19.9721 5.24341L11.0098 14.2058L14.3067 17.5004Z"
      fill="#F3BA2F"
    />
    <path
      d="M5.38477 19.8286L8.68051 16.5329L11.9763 19.8286L8.68051 23.1244L5.38477 19.8286Z"
      fill="#F3BA2F"
    />
    <path
      d="M14.3055 22.1568L19.9709 27.8223L25.6386 22.1545L28.9356 25.4469L28.9332 25.4492L19.9709 34.4139L11.0085 25.4538L11.0039 25.4492L14.3055 22.1568Z"
      fill="#F3BA2F"
    />
    <path
      d="M27.9629 19.8298L31.2586 16.5341L34.5544 19.8298L31.2586 23.1256L27.9629 19.8298Z"
      fill="#F3BA2F"
    />
    <path
      d="M23.3157 19.8278L19.9726 16.4824L17.5005 18.9546L17.2148 19.2379L16.6296 19.8232L16.625 19.8278L16.6296 19.8347L19.9726 23.1754L23.3157 19.8301L23.318 19.8278H23.3157Z"
      fill="#F3BA2F"
    />
  </svg>
)

export default Binance
