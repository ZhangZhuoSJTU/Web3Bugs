import { useState, useEffect } from 'react'
import styled, { DefaultTheme } from 'styled-components'
import { media } from 'prepo-ui'
import { numberFormatter } from '../utils/numberFormatter'

const { percent, rawPercent } = numberFormatter

type StylesProps = {
  fontSize?: keyof DefaultTheme['fontSize']
  fontWeight?: keyof DefaultTheme['fontWeight']
}

type Props = {
  value: string | number
  format?: (percentValue: string) => string
  styles?: StylesProps
  showPlusSign?: boolean
  percentagePrecision?: number
  className?: string
}

const Green = styled.span`
  color: ${({ theme }): string => theme.color.success};
`

const Red = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

const Wrapper = styled.p<{ styles: StylesProps }>`
  font-size: ${({ styles, theme }): string => theme.fontSize[styles.fontSize || 'xs']};
  font-weight: ${({ styles, theme }): number => theme.fontWeight[styles.fontWeight || 'semiBold']};
  line-height: 20px;
  margin: 0;

  ${media.tablet<{ styles: StylesProps }>`
    font-size: ${({ styles, theme }): string => theme.fontSize[styles.fontSize || 'sm']};
  `}
`

const Percent: React.FC<Props> = ({
  value,
  format,
  showPlusSign = false,
  styles = {},
  percentagePrecision,
  className,
}) => {
  const [percentageValue, setPercentageValue] = useState<string | undefined>(
    percent(value, percentagePrecision)
  )
  const rawPercentValue = rawPercent(value, percentagePrecision)
  const percentValue = percent(value, percentagePrecision)

  useEffect(() => {
    if (format) {
      const overrideFormat = format(
        showPlusSign && value > 0 ? `+${percentValue}` : `${percentValue}`
      )
      setPercentageValue(overrideFormat)
    }
  }, [value, format, percentValue, showPlusSign])

  if (rawPercentValue === undefined) {
    return null
  }

  return (
    <Wrapper styles={styles} className={className}>
      {+rawPercentValue >= 0 ? <Green>{percentageValue}</Green> : <Red>{percentageValue}</Red>}
    </Wrapper>
  )
}

export default Percent
