import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const DocsIcon: React.FC<Props> = ({ color = 'white', width = '17', height = '20', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 17 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M9.422 0H2.25C1.15 0 0.25 0.9 0.25 2V18C0.25 19.1 1.15 20 2.25 20H14.25C15.35 20 16.25 19.1 16.25 18V6.828C16.25 6.298 16.039 5.789 15.664 5.414L10.836 0.586C10.461 0.211 9.952 0 9.422 0ZM8.75 17H4.75C4.474 17 4.25 16.776 4.25 16.5V15.5C4.25 15.224 4.474 15 4.75 15H8.75C9.026 15 9.25 15.224 9.25 15.5V16.5C9.25 16.776 9.026 17 8.75 17ZM11.75 14H4.75C4.474 14 4.25 13.776 4.25 13.5V12.5C4.25 12.224 4.474 12 4.75 12H11.75C12.026 12 12.25 12.224 12.25 12.5V13.5C12.25 13.776 12.026 14 11.75 14ZM11.75 11H4.75C4.474 11 4.25 10.776 4.25 10.5V9.5C4.25 9.224 4.474 9 4.75 9H11.75C12.026 9 12.25 9.224 12.25 9.5V10.5C12.25 10.776 12.026 11 11.75 11ZM9.25 7V1.5L14.75 7H9.25Z"
        fill={color}
      />
    </svg>
  )
}

export default DocsIcon
