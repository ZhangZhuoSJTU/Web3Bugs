import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const WaterDropIcon: React.FC<Props> = ({ width = '24', height = '24', color = 'white' }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.652 2.76619C12.855 1.81719 11.399 1.81719 10.602 2.76619C8.28095 5.53019 4.12695 11.0182 4.12695 14.8882C4.12695 19.3452 7.66995 22.8882 12.127 22.8882C16.584 22.8882 20.127 19.3452 20.127 14.8882C20.127 11.0182 15.973 5.53019 13.652 2.76619Z"
        fill={color}
      />
    </svg>
  )
}

export default WaterDropIcon
