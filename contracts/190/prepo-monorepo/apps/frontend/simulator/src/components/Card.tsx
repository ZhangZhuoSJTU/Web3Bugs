import React from 'react'
import styled, { css, FlattenSimpleInterpolation } from 'styled-components'
import { spacingIncrement } from '../features/app/themes'
import { media } from '../utils/media'

export const cardPadding = css`
  padding-bottom: ${spacingIncrement(2.5)};
  padding-left: ${spacingIncrement(5)};
  padding-right: ${spacingIncrement(5)};
  padding-top: ${spacingIncrement(2.5)};

  ${media.lg`
    padding: ${spacingIncrement(2.2)};
  `}
`

const Wrapper = styled.div<{ noPadding: boolean }>`
  background: ${({ theme }): string => theme.colors.foreground};
  border: 1px solid ${({ theme }): string => theme.colors.accent};
  border-radius: 0.75rem;

  ${({ noPadding }): FlattenSimpleInterpolation | string => {
    if (noPadding) return ''

    return cardPadding
  }}
`

type Props = {
  className?: string
  noPadding?: boolean
}

const Card: React.FC<Props> = ({ noPadding = false, className, children }) => (
  <Wrapper className={className} noPadding={noPadding}>
    {children}
  </Wrapper>
)

export default Card
