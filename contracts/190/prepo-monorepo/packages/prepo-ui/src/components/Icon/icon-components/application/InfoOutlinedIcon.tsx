import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const InfoOutlinedIcon: React.FC<Props> = ({ color = 'white', width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.4568 1.66667C5.86431 1.66667 2.12347 5.4075 2.12347 10C2.12347 14.5925 5.86431 18.3333 10.4568 18.3333C15.0493 18.3333 18.7901 14.5925 18.7901 10C18.7901 5.4075 15.0493 1.66667 10.4568 1.66667ZM10.4568 3.33334C14.1486 3.33334 17.1235 6.30824 17.1235 10C17.1235 13.6918 14.1486 16.6667 10.4568 16.6667C6.76504 16.6667 3.79014 13.6918 3.79014 10C3.79014 6.30824 6.76504 3.33334 10.4568 3.33334ZM9.62347 5.83334V7.50001H11.2901V5.83334H9.62347ZM9.62347 9.16667V14.1667H11.2901V9.16667H9.62347Z"
      fill={color}
    />
  </svg>
)

export default InfoOutlinedIcon
