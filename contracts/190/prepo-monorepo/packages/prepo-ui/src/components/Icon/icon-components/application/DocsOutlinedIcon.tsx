import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const DocsOutlinedIcon: React.FC<Props> = ({ color = 'white', width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.45683 1.66667C4.54495 1.66667 3.79016 2.42146 3.79016 3.33333V16.6667C3.79016 17.5785 4.54495 18.3333 5.45683 18.3333H15.4568C16.3687 18.3333 17.1235 17.5785 17.1235 16.6667V5.48828L13.3019 1.66667H5.45683ZM5.45683 3.33333H12.1235V6.66667H15.4568V16.6667H5.45683V3.33333ZM7.12349 8.33333V10H13.7902V8.33333H7.12349ZM7.12349 10.8333V12.5H13.7902V10.8333H7.12349ZM7.12349 13.3333V15H11.2902V13.3333H7.12349Z"
      fill={color}
    />
  </svg>
)

export default DocsOutlinedIcon
