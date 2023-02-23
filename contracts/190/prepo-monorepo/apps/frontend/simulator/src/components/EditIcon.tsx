import React from 'react'
import styled from 'styled-components'
import PencilIcon from '../assets/images/pencil-icon.svg'

const BorderImg = styled.img`
  background-color: ${({ theme }): string => theme.colors.foreground};
  border: 1px solid black;
  border-radius: 0.5rem;
  cursor: pointer;
  height: 1.625rem;
  padding: 0.2rem;
`

type Props = {
  style?: React.CSSProperties
  onClick?: () => void
}

const EditIcon: React.FC<Props> = ({ style, onClick, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <BorderImg src={PencilIcon} style={style} onClick={onClick} {...props} />
)

export default EditIcon
