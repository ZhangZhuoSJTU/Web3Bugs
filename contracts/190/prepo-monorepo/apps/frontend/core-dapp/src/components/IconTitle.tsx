import styled, { Color, DefaultTheme, Weight } from 'styled-components'
import { spacingIncrement, media, IconName, Icon } from 'prepo-ui'

type StyleProps = {
  spacingValue: number
}

type MarketNameStyleProps = {
  color?: keyof Color
  weight?: keyof Weight
  labelFontSize?: keyof DefaultTheme['fontSize']
}

const Wrapper = styled.div`
  align-items: center;
  display: flex;
`

const IconWrapper = styled.div<StyleProps>`
  height: ${({ spacingValue }): string => spacingIncrement(spacingValue)};
  margin-right: ${spacingIncrement(10)};
  width: ${({ spacingValue }): string => spacingIncrement(spacingValue)};
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
`

const MarketName = styled.span<{ styles: MarketNameStyleProps }>`
  color: ${({ theme, styles }): string => theme.color[styles.color || 'secondary']};
  font-size: ${({ theme, styles }): string => theme.fontSize[styles.labelFontSize || 'base']};
  font-weight: ${({ theme, styles }): number => theme.fontWeight[styles.weight || 'semiBold']};
  line-height: 20px;

  ${media.desktop<{ styles: MarketNameStyleProps }>`
    font-size: ${({ theme, styles }): string => theme.fontSize[styles.labelFontSize || '4xl']};
  `}
`

const Description = styled.div<{ styles: MarketNameStyleProps }>`
  color: ${({ theme, styles }): string => theme.color[styles.color || 'secondary']};
  font-size: ${({ theme }): string => theme.fontSize['2xs']};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  padding-top: ${spacingIncrement(2)};
`

type Props = {
  id?: string
  iconName: IconName
  iconSize?: number
  description?: string
  className?: string
} & MarketNameStyleProps

const IconTitle: React.FC<Props> = ({
  id,
  iconName,
  iconSize,
  weight,
  description,
  color,
  className,
  children,
  labelFontSize,
}) => {
  let spacingValue = description ? 34 : 30
  if (iconSize) {
    spacingValue = iconSize
  }
  return (
    <Wrapper className={className}>
      <IconWrapper spacingValue={spacingValue}>
        <Icon
          id={id}
          name={iconName}
          height={spacingIncrement(spacingValue)}
          width={spacingIncrement(spacingValue)}
        />{' '}
      </IconWrapper>
      <TextContainer>
        <MarketName
          styles={{
            labelFontSize,
            color,
            weight,
          }}
        >
          {children}
        </MarketName>
        {description && (
          <Description
            styles={{
              color,
            }}
          >
            {description}
          </Description>
        )}
      </TextContainer>
    </Wrapper>
  )
}

export default IconTitle
