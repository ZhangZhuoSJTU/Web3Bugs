import React from 'react'
import themes from '../app/themes'

type Props = {
  disabled?: boolean
}

const LongIcon: React.FC<Props> = ({ disabled }) => {
  const strokeColor = disabled ? themes.standard.colors.accent : themes.standard.colors.profit

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17.133"
      height="10.79"
      viewBox="0 0 17.133 10.79"
    >
      <path
        d="M4,15,8,9l4,2,4-5,3.2.719"
        transform="translate(-2.96 -5.25)"
        fill="none"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default LongIcon
