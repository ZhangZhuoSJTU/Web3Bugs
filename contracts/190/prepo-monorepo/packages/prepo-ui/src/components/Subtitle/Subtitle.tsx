import { Tooltip } from 'antd'
import styled, { Color } from 'styled-components'
import { IconName } from '../Icon/icon.types'
import Icon from '../Icon'
import { media, spacingIncrement } from '../../common-utils'
import useResponsive from '../../hooks/useResponsive'

type IconStyles = {
  name: IconName
  color: keyof Color
  desktopIconDiameter: number
  mobileIconDiameter: number
}

export type SubtitleProps = {
  className?: string
  tooltip?: string
  iconStyles?: IconStyles
}

const DEFAULT_ICON_STYLES: IconStyles = {
  name: 'info',
  desktopIconDiameter: 20,
  mobileIconDiameter: 13,
  color: 'neutral5',
}

const Wrapper = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral3};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  line-height: 20px;

  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const Title = styled.p`
  margin: 0;
`

const IconWrapper = styled.span`
  display: flex;
  margin-left: ${spacingIncrement(2)};
`

const InfoIcon = styled(Icon)`
  display: inherit;
`

const Subtitle: React.FC<SubtitleProps> = ({
  tooltip,
  className,
  iconStyles = DEFAULT_ICON_STYLES,
  children,
}) => {
  const { isDesktop } = useResponsive()
  const iconDiameter = isDesktop ? iconStyles.desktopIconDiameter : iconStyles.mobileIconDiameter
  return (
    <Wrapper className={className}>
      <Title>{children}</Title>
      {tooltip && (
        <Tooltip title={tooltip}>
          <IconWrapper>
            <InfoIcon
              name={iconStyles.name}
              height={`${iconDiameter}px`}
              width={`${iconDiameter}px`}
              color={iconStyles.color}
            />
          </IconWrapper>
        </Tooltip>
      )}
    </Wrapper>
  )
}

export default Subtitle
