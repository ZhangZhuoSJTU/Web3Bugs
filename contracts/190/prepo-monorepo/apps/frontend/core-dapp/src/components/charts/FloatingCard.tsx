import { ReactElement, ReactNode, RefObject, forwardRef } from 'react'
import styled, { CSSProperties } from 'styled-components'
import { coreDappTheme, spacingIncrement } from 'prepo-ui'
import { FormatPrice, FormatTime, DetailsProps } from './chart-types'
import { formatChartTooltipTime } from './utils'
import { numberFormatter } from '../../utils/numberFormatter'

const { toUsd } = numberFormatter

const { Z_INDEX } = coreDappTheme

type Props = {
  label?: ReactNode | string
  style?: CSSProperties
  value?: ReactNode | string
}

const Label = styled.p`
  color: ${({ theme }): string => theme.color.neutral4};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  margin: 0;
`
const Value = styled.p`
  color: ${({ theme }): string => theme.color.success};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin: 0;
`
const Wrapper = styled.div`
  background-color: ${({ theme }): string => theme.color.marketChartFloatingCard};
  border: 1px solid ${({ theme }): string => theme.color.primaryAccent};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  padding: ${spacingIncrement(14)};
  text-align: center;
  width: max-content;
  z-index: ${Z_INDEX.floatingBox};
`

export const FloatingCard = forwardRef<HTMLDivElement, Props>(({ label, style, value }, ref) => (
  <Wrapper ref={ref} style={style}>
    <Label>{label}</Label>
    <Value>{value}</Value>
  </Wrapper>
))

export const renderFloatingCardWithChartDetails = (
  ref: RefObject<HTMLDivElement>,
  details?: DetailsProps,
  formatPrice: FormatPrice = toUsd,
  formatTime: FormatTime = formatChartTooltipTime
): ReactElement | null => {
  if (!details) return null

  const label = formatTime(details.time, details.timeframe)
  const price = formatPrice(details.price)

  return (
    <FloatingCard
      style={{ position: 'absolute', ...details.position }}
      ref={ref}
      label={label}
      value={price}
    />
  )
}

FloatingCard.displayName = 'Floating Card'

export default FloatingCard
