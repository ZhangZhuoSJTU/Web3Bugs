/* eslint-disable react/no-unescaped-entities */
import React from 'react'
import styled from 'styled-components'
import Button from '../../components/Button'
import { useModalContext } from '../../components/Modal/ModalContext'
import { spacingIncrement } from '../app/themes'
import { media } from '../../utils/media'
import useBreakpoint from '../../hooks/useBreakpoint'

const Wrapper = styled.div`
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }): string => theme.fontSize.lg};
  justify-content: flex-end;
  text-align: center;

  ${media.lg`
    flex-direction: row;
    align-items: center;
    font-size: ${({ theme }): string => theme.fontSize.xsm};
  `}
`

const Description = styled.p`
  line-height: 1.625rem;
  margin: 0;
  margin-bottom: ${spacingIncrement(1)};
  margin-right: ${spacingIncrement(1)};
  max-width: 40%;

  ${media.lg`
    max-width: 100%;
    margin-bottom: 0;
  `}
`

const RestoreLabState: React.FC = () => {
  const { setShowModal } = useModalContext()
  const breakPoint = useBreakpoint()

  const buttonText = breakPoint === 'md' ? 'Restore' : 'Restore last simulation'

  return (
    <Wrapper>
      <Description>Pressed the 'Start over' button accidentally?</Description>
      <Button onClick={(): void => setShowModal(false)} size="small">
        {buttonText}
      </Button>
    </Wrapper>
  )
}

export default RestoreLabState
