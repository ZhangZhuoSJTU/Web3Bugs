/* eslint-disable react/no-unescaped-entities */
import React from 'react'
import styled from 'styled-components'
import Button from '../../components/Button'
import { useModalContext } from '../../components/Modal/ModalContext'
import { actions as positionActions } from '../position/position-slice'
import { actions as appActions } from '../app/app-slice'
import { media } from '../../utils/media'
import { useAppDispatch } from '../../app/hooks'
import { spacingIncrement } from '../app/themes'
import Logo from '../../components/Logo'

const Wrapper = styled.div`
  ${media.lg`
    height: auto;
  `}
`

const Container = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;

  margin: 0 auto;
  max-width: 80%;

  ${media.lg`
    max-width: 100%;
  `}
`

const Title = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.xl};
  margin-bottom: ${spacingIncrement(0.5)};
`

const TopWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;

  ${media.lg`
    justify-content: center;
    align-items: center;
  `}
`

const WelcomeText = styled.p`
  a {
    color: ${({ theme }): string => theme.colors.primary};

    &:hover {
      text-decoration: underline;
    }
  }

  line-height: ${spacingIncrement(3.37)};

  margin: ${spacingIncrement(4)} 0;

  ${media.lg`
    line-height: ${spacingIncrement(2.75)};
    margin: ${spacingIncrement(3)} 0;
  `}
`

const ButtonsWrapper = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;

  ${media.lg`
    flex-direction: column;
  `}
`

const PrimaryButton = styled(Button)`
  margin-bottom: 0;
  margin-left: ${spacingIncrement(2.1)};

  ${media.lg`
    margin-left: 0;
    margin-bottom: ${spacingIncrement(2.5)};
  `}
`

const Footer = styled.a`
  color: ${({ theme }): string => theme.colors.primary};
  float: right;
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  margin-top: ${spacingIncrement(2)};
  padding-bottom: ${spacingIncrement(2)};
  text-decoration: none;
`

const WelcomeModal: React.FC = () => {
  const dispatch = useAppDispatch()
  const { setShowModal } = useModalContext()

  const enterLab = (): void => {
    setShowModal(false)
    dispatch(positionActions.reset())
    dispatch(appActions.reset())
  }

  return (
    <Wrapper>
      <Container>
        <TopWrapper>
          <Title>Welcome to</Title>
          <Logo />
        </TopWrapper>
        <WelcomeText>
          <span>
            <b>prePO Simulator</b> is a tool for playing out different scenarios as a Trader or
            Liquidity Provider (LP) on the prePO platform. Through the Simulator, we aim to
            facilitate a deeper understanding of how prePO works, including the impact of different
            inputs and parameters.
          </span>
          <br />
          <br />
          <span>
            The Simulator is still in beta, so any feedback is much appreciated (you can use the
            built-in Userback widget). Calculations are subject to change, and this simulator is not
            intended to act as financial advice.
          </span>
        </WelcomeText>
        <ButtonsWrapper>
          <PrimaryButton type="primary" onClick={enterLab}>
            Enter Simulator
          </PrimaryButton>
        </ButtonsWrapper>
      </Container>
      <Footer href="https://prepo.io/" target="_blank">
        Visit us at prepo.io
      </Footer>
    </Wrapper>
  )
}

export default WelcomeModal
