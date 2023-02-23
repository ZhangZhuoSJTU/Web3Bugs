import { ReactNode } from 'react'
import styled from 'styled-components'
import { spacingIncrement, media } from 'prepo-ui'
import Percent from './Percent'
import Subtitle from './Subtitle'

type Props = {
  title: ReactNode | string
  value: string | number
  tooltip?: ReactNode
  percent?: number
  formatValue?: (value: string | number) => string | number
}

const PercentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: flex-end;
  padding-bottom: ${spacingIncrement(1)};
`

const Value = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.base};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.largeDesktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: 20px;
  margin: 0;
  margin-top: ${spacingIncrement(12)};
`

const Wrapper = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.neutral9};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-radius: 1px;
  display: flex;
  height: 100%;
  justify-content: space-between;
  padding: ${spacingIncrement(18)} ${spacingIncrement(22)};
`

const Title = styled(Subtitle)`
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: ${spacingIncrement(4)};
`

const FinancialInfoCard: React.FC<Props> = ({ formatValue, percent, title, tooltip, value }) => {
  let formattedValue = value
  if (formatValue) {
    formattedValue = formatValue(value)
  }
  return (
    <Wrapper>
      <div>
        <Title tooltip={tooltip}>{title}</Title>
        <Value>{formattedValue}</Value>
      </div>
      <PercentWrapper>
        {percent !== undefined && (
          <Percent format={(percentValue): string => percentValue} showPlusSign value={percent} />
        )}
      </PercentWrapper>
    </Wrapper>
  )
}

export default FinancialInfoCard
