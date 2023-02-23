import React from 'react'
import styled from 'styled-components'
import MinusIcon from '../assets/images/minus.svg'
import PlusIcon from '../assets/images/plus.svg'
import { noSelect } from '../utils/style-utils'
import PencilIcon from '../assets/images/pencil-icon.svg'

const Wrapper = styled.div`
  ${noSelect};
  align-items: center;
  background-color: ${({ theme }): string => theme.colors.foreground};
  border: 1px solid ${({ theme }): string => theme.colors.accentLight};
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;

  height: 1.4rem;
  justify-content: center;
  position: relative;
  width: 1.4rem;
`

const Icon = styled.img`
  height: 0.7rem;
  position: absolute;
  width: 0.7rem;
`

type SupportedIcons = 'pencil' | 'minus' | 'plus'

type Props = {
  onClick?: () => void
  icon: SupportedIcons
}

// TODO - lazy load icons
const ButtonIcon: React.FC<Props> = ({ onClick, icon, ...props }) => {
  const iconList = {
    pencil: PencilIcon,
    minus: MinusIcon,
    plus: PlusIcon,
  }

  return (
    <Wrapper onClick={onClick}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <Icon src={iconList[icon]} {...props} />
    </Wrapper>
  )
}

export default ButtonIcon
