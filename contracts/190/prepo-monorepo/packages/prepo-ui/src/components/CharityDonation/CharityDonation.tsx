import styled, { useTheme } from 'styled-components'
import { useEffect, useState } from 'react'
import { Col, Row } from 'antd'
import Icon from '../Icon'
import Subtitle from '../Subtitle'
import { centered, media, spacingIncrement } from '../../common-utils'
import Slider, { SliderValue } from '../Slider'
import { IconName } from '../Icon/icon.types'

const Wrapper = styled.div``

const Header = styled.div`
  display: flex;
  justify-content: space-between;
`

const Title = styled(Subtitle)`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-left: ${spacingIncrement(4)};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.md};
    svg {
      height: ${spacingIncrement(18)};
      width: ${spacingIncrement(18)};
    }
  `}
`

const TitleWrapper = styled.div`
  align-items: center;
  display: flex;
  .charity_donation_gift_icon {
    height: ${spacingIncrement(16)};
    svg {
      height: ${spacingIncrement(16)};
      width: ${spacingIncrement(16)};
    }
    ${media.tablet`
    height: ${spacingIncrement(24)};
      svg{
        height: ${spacingIncrement(24)};
        width: ${spacingIncrement(24)};
      }
      `}
  }
`

const Body = styled(Row)`
  margin-top: ${spacingIncrement(50)};
`

const Footer = styled.div`
  ${centered};
  background-color: ${({ theme }): string => theme.color.alertBoxSuccess};
  margin-top: ${spacingIncrement(30)};
  padding: ${spacingIncrement(12)};
`

const FooterText = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin: 0;
  padding: 0 ${spacingIncrement(12)};
`

const Balance = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};

  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

export type Props = {
  title: string
  tooltip?: string
  balance?: string
  onChange?: (value: number) => unknown
  footerText?: string
}

const CharityDonation: React.FC<Props> = ({
  title = 'Charity Donation',
  footerText = 'You are donating above average, 96% more than the usual donation.',
  tooltip,
  onChange,
  balance,
}) => {
  const theme = useTheme()
  const [value, setValue] = useState<SliderValue>(0)
  const [emojiName, setEmojiName] = useState<IconName>('emojiSmile')

  const onChangeSlider = (newValue: SliderValue): void => {
    setValue(newValue)
    if (onChange) onChange(newValue as number)
  }

  useEffect(() => {
    if (value >= 1.6) {
      setEmojiName('emojiHalo')
    }
    if (value >= 1.2 && value < 1.6) {
      setEmojiName('emojiHeartEyes')
    }
    if (value >= 0.8 && value < 1.2) {
      setEmojiName('emojiSmile')
    }
    if (value >= 0.4 && value < 0.8) {
      setEmojiName('emojiHappy')
    }
    if (value < 0.4) {
      setEmojiName('emojiSad')
    }
  }, [value])

  return (
    <Wrapper>
      <Header>
        <TitleWrapper>
          <Icon className="charity_donation_gift_icon" name="emojiHeartWithRibbon" />
          <Title tooltip={tooltip}>{title}</Title>
        </TitleWrapper>
        {balance && <Balance>{balance}</Balance>}
      </Header>
      <Body gutter={1}>
        <Col xs={3} md={1}>
          <Icon name={emojiName} height="28" width="28" />
        </Col>
        <Col xs={20} md={22}>
          <Slider
            labelPosition="none"
            labelSpacing="normal"
            max={2}
            min={0}
            step={0.005}
            tooltipLabels={['', '']}
            thumbBorder={`solid 2px ${theme.color.success}`}
            numberFormatter={(valueWithoutFormat): string => `${valueWithoutFormat}%`}
            onChange={onChangeSlider}
            trackColor="success"
            trackUnderlyingColor="neutral7"
            value={value}
          />
        </Col>
      </Body>
      <Footer>
        <Icon name="donation" height="34" width="34" />
        <FooterText>{footerText}</FooterText>
      </Footer>
    </Wrapper>
  )
}

export default CharityDonation
