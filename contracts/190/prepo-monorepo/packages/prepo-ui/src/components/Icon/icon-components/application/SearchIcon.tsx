import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const SearchIcon: React.FC<Props> = ({ color = 'white', width = '25', height = '24', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 25 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M10.7167 1.92004C5.95614 1.92004 2.07666 5.79952 2.07666 10.56C2.07666 15.3206 5.95614 19.2 10.7167 19.2C12.4551 19.2 14.073 18.6787 15.4304 17.79L21.4585 23.8182L23.4948 21.7819L17.5445 15.8316C18.6758 14.3705 19.3567 12.5447 19.3567 10.56C19.3567 5.79952 15.4772 1.92004 10.7167 1.92004ZM10.7167 3.84004C14.4397 3.84004 17.4367 6.83705 17.4367 10.56C17.4367 14.283 14.4397 17.28 10.7167 17.28C6.99366 17.28 3.99666 14.283 3.99666 10.56C3.99666 6.83705 6.99366 3.84004 10.7167 3.84004Z"
        fill="current"
      />
    </svg>
  )
}

export default SearchIcon
