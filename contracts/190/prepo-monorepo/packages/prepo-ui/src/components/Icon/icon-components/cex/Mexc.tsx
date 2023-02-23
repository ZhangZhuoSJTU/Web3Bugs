import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const Mexc: React.FC<Props> = ({ width = '40', height = '40' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="38.8939" height="38.8939" transform="translate(0.523438 0.376099)" fill="white" />
    <g clipPath="url(#clip0_5573_6498)">
      <path
        d="M34.09 23.6029L27.7873 12.6753C26.3957 10.4039 23.0397 10.363 21.7096 12.7777L15.0794 24.1554C13.8516 26.2427 15.3659 28.862 17.842 28.862H31.1024C33.5989 28.862 35.4611 26.1608 34.09 23.6029Z"
        fill="#00B897"
      />
      <path
        d="M24.9844 24.4625L24.5956 23.7872C24.2273 23.1528 23.4292 21.8022 23.4292 21.8022L18.0882 12.5322C17.0241 10.9156 14.8549 10.4859 13.2383 11.55C12.7267 11.8774 12.3175 12.3481 12.0514 12.9006L5.85098 23.6439C4.88919 25.3015 5.46217 27.4297 7.14019 28.3915C7.67224 28.6984 8.26568 28.8622 8.87959 28.8622H31.0416C27.6242 28.8826 26.5396 27.1023 24.9844 24.4625Z"
        fill="#76FCB2"
      />
    </g>
    <defs>
      <clipPath id="clip0_5573_6498">
        <rect
          width="29.1704"
          height="25.3672"
          fill="white"
          transform="translate(5.38477 7.03137)"
        />
      </clipPath>
    </defs>
  </svg>
)

export default Mexc
