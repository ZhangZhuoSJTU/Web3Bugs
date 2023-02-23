import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const SpacexIcon: React.FC<Props> = ({ width = '25', height = '24', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 45 45"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <circle cx="22.972" cy="22.7848" r="22.0276" fill="#005288" />
      <path
        d="M19.7491 18.9199H14.8215L14.5542 19.4291L20.0268 23.4174C21.0645 22.8202 22.1934 22.208 23.4208 21.6077"
        fill="white"
      />
      <path
        d="M24.168 26.4457L28.982 29.9562H33.9738L34.1799 29.4918L26.9916 24.2313C26.037 24.9281 25.0957 25.6667 24.168 26.4472"
        fill="white"
      />
      <path
        d="M19.0167 29.9428H14.555L14.1787 29.3455C17.2054 26.4233 30.7801 13.8655 60.2738 12.5216C60.2738 12.5216 35.5181 13.3563 19.0152 29.9428"
        fill="white"
      />
    </svg>
  )
}

export default SpacexIcon
