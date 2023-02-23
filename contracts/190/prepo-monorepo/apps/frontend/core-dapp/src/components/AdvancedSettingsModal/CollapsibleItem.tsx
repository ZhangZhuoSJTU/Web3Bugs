import { Icon, media, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import styled from 'styled-components'

type Props = {
  title: React.ReactNode
  description?: React.ReactNode
  onChange?: (collapsed: boolean) => unknown
}

const IconWrapper = styled(Icon)<{ $inverted?: boolean }>`
  cursor: pointer;
  transform: ${({ $inverted }): string => `rotate(${!$inverted ? '180deg' : '0deg'})`};
  transition: transform 0.2s ease;
`

const Wrapper = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.primaryAccent};
  padding: ${spacingIncrement(20)} 0;
  :last-child {
    border-bottom: none;
  }
`

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

export const Title = styled.div`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const CollapsibleItem: React.FC<Props> = ({ title, description, onChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  const handleOnClick = (): void => {
    if (onChange) onChange(!isCollapsed)
    setIsCollapsed(!isCollapsed)
  }
  return (
    <Wrapper>
      <TitleWrapper>
        {typeof title === 'string' ? <Title>{title}</Title> : title}
        <IconWrapper
          name="arrow-down"
          color="neutral2"
          height="24"
          width="24"
          $inverted={isCollapsed}
          onClick={handleOnClick}
        />
      </TitleWrapper>
      {!isCollapsed && description}
    </Wrapper>
  )
}

export default CollapsibleItem
