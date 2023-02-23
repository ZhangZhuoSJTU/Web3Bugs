import { Box, Icon, media, spacingIncrement } from 'prepo-ui'
import React, { useState } from 'react'
import styled from 'styled-components'
import Accordion from '../../components/Accordion'
import useResponsive from '../../hooks/useResponsive'

const StyledAccordion = styled(Accordion)<{ $active: boolean }>`
  > button {
    border: none;
    padding: ${spacingIncrement(28)} ${spacingIncrement(20)} ${spacingIncrement(12)}
      ${spacingIncrement(21)};
    ${media.desktop`
      padding: ${spacingIncrement(42)} ${spacingIncrement(46)} ${spacingIncrement(22)};
    `}
  }
  > div {
    border: none;
    border-top: ${({ $active, theme }): string =>
      $active ? `1px solid ${theme.color.neutral8}` : 'none'};
    padding: 0;
  }
`

const StyledIcon = styled(Icon)<{ $active: boolean }>`
  margin-right: ${spacingIncrement(6)};
  transform: ${({ $active }): string => `rotate(${$active ? '180' : '0'}deg)`};
  transition: transform 0.2s;
`

const SectionAccordion: React.FC<{ title: JSX.Element; className?: string }> = ({
  title,
  children,
  className,
}) => {
  const [active, setActive] = useState(true)
  const { isDesktop } = useResponsive()

  return (
    <StyledAccordion
      className={className}
      $active={active || isDesktop}
      title={title}
      onChange={setActive}
      hideIcon={isDesktop}
      visible={active || isDesktop}
      renderIcon={(expanded): JSX.Element => (
        <StyledIcon name="sort-down" width="18" height="10" color="neutral3" $active={expanded} />
      )}
    >
      <Box pb={{ phone: 20, desktop: 5 }}>{children}</Box>
    </StyledAccordion>
  )
}

export default SectionAccordion
