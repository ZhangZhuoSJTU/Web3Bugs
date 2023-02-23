import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const HistoryIcon: React.FC<Props> = ({ width = '24', height = '24', color = 'white' }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 19.689H17V17.103C17 16.573 16.789 16.064 16.414 15.689L13.414 12.689L16.414 9.68896C16.789 9.31396 17 8.80497 17 8.27496V5.68896H18C18.552 5.68896 19 5.24096 19 4.68896C19 4.13696 18.552 3.68896 18 3.68896H6C5.448 3.68896 5 4.13696 5 4.68896C5 5.24096 5.448 5.68896 6 5.68896H7V8.27496C7 8.80497 7.211 9.31396 7.586 9.68896L10.586 12.689L7.586 15.689C7.211 16.064 7 16.573 7 17.103V19.689H6C5.448 19.689 5 20.137 5 20.689C5 21.241 5.448 21.689 6 21.689H18C18.552 21.689 19 21.241 19 20.689C19 20.137 18.552 19.689 18 19.689Z"
        fill={color}
      />
    </svg>
  )
}

export default HistoryIcon
