import { Col, Row } from 'antd'
import { Button, media, spacingIncrement } from 'prepo-ui'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import DelegateCustomAddressModal from './delegate-custom-address/DelegateCustomAddressModal'
import DelegateCustomAddressAccordion from './delegate-custom-address/DelegateCustomAddressAccordion'
import DelegateList from './DelegateList'
import { Routes } from '../../lib/routes'
import useResponsive from '../../hooks/useResponsive'
import PageDescription from '../ppo/PageDescription'
import BackButton from '../ppo/BackButton'
import Heading from '../../components/Heading'

const Wrapper = styled.div`
  border: none;

  ${media.desktop`
    margin-top: ${spacingIncrement(52)};
    border: 1px solid ${({ theme }): string => theme.color.neutral8};
  `}
`

const Top = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 0;

  ${media.desktop`
    padding: ${spacingIncrement(35)} ${spacingIncrement(45)};
  `}
`

const Title = styled(Heading)`
  align-self: center;
  color: ${({ theme }): string => theme.color.accent3};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(26)};
  text-align: center;

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
    text-align: left;
    line-height: ${spacingIncrement(30)};
  `}
`

const Description = styled(PageDescription)`
  margin: ${spacingIncrement(22)} 0;
  text-align: left;

  ${media.desktop`
    margin: 0;
  `}
`

const DelegatePage: React.FC = () => {
  const router = useRouter()
  const { isPhone, isTablet, isDesktop, isLargeDesktop } = useResponsive()
  const [visible, setVisible] = useState<boolean>(false)
  const showDesktop = isDesktop || isLargeDesktop
  const showMobile = isPhone || isTablet

  useEffect(() => {
    if (router.pathname === Routes.Delegate_Custom_Address) {
      setVisible(true)
    }
  }, [router])

  useEffect(() => {
    window.scroll(0, 0)
  }, [])

  return (
    <Wrapper>
      <Top>
        <div>
          <Row>
            <Col xs={1} md={2}>
              <BackButton href={Routes.Govern} />
            </Col>
            <Col xs={22}>
              <Title align="left" type="h4">
                Select Delegate
              </Title>
            </Col>
            <Col xs={1} md={0} />
          </Row>
          <Row>
            <Col xs={0} md={2} />
            <Col xs={24} md={22}>
              <Description>
                Remember you’re delegating all your votes. You can delegate vote to a specific
                address or choose from the delegate list.
              </Description>
            </Col>
          </Row>
        </div>
        {showDesktop && (
          <Button type="primary" href={Routes.Delegate_Custom_Address}>
            Delegate to Custom Address
          </Button>
        )}
      </Top>

      {showDesktop && <DelegateCustomAddressModal visible={visible} />}
      <DelegateList />
      {showMobile && (
        <Button type="primary" block>
          Delegate Address
        </Button>
      )}
      {showMobile && <DelegateCustomAddressAccordion visible={visible} />}
    </Wrapper>
  )
}

export default DelegatePage
