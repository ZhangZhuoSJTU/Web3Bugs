import React from 'react'
import styled from 'styled-components'
import Div100vh from 'react-div-100vh'
import { Col, Row } from 'antd'
import { useModalContext } from './Modal/ModalContext'
import Header from './Header'
import ImagePreloader from '../features/position-settings/ImagePreloader'
import PositionSettings from '../features/position-settings/PositionSettings'
import markets from '../features/position/markets'
import Outcome from '../features/outcome/Outcome'
import { spacingIncrement } from '../features/app/themes'
import { media } from '../utils/media'

const OuterWrapper = styled(Div100vh)<{ show: boolean }>`
  display: ${({ show }): string => (show ? 'flex' : 'none')};
`

const AppLayout = styled.div`
  margin: 0 auto;
  max-width: 80rem;
  padding: 1rem;
  width: 100%;
`

const Footer = styled.div`
  bottom: 0;
  font-weight: 800;
  margin-right: ${spacingIncrement(6)};
  position: absolute;
  right: 0;

  ${media.lg`
    display: none;
  `}

  a {
    color: ${({ theme }): string => theme.colors.primary};
    float: right;
    font-size: ${({ theme }): string => theme.fontSize.xsm};
    margin-top: ${spacingIncrement(2)};
    padding-bottom: ${spacingIncrement(2)};
    text-decoration: none;
  }
`

const Simulation: React.FC = () => {
  const { showModal } = useModalContext()
  return (
    <OuterWrapper show={!showModal}>
      <AppLayout>
        <Header />
        <Row gutter={[32, 32]}>
          <Col xs={24} lg={12}>
            <PositionSettings />
          </Col>
          <Col xs={24} lg={12}>
            <Outcome />
          </Col>
        </Row>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore */}
        <ImagePreloader srcs={[...markets].map(([, market]) => market.logo.src)} />
      </AppLayout>
      <Footer>
        <a href="https://prepo.io/" target="_blank" rel="noreferrer">
          Visit us at prepo.io
        </a>
      </Footer>
    </OuterWrapper>
  )
}

export default Simulation
