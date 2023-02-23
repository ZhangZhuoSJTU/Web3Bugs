import React from 'react'
import styled from 'styled-components'
import { formatPercent } from '../helpers'

type Sign = '' | '+' | '-'

function getSign(percent: number): Sign {
  if (percent === 0) return ''
  if (percent > 0) return '+'
  return '-'
}

type Props = {
  roi: number
  style?: React.CSSProperties
}

const Wrapper = styled.span<{ sign: Sign }>`
  color: ${({ theme, sign }): string => (sign === '-' ? theme.colors.loss : theme.colors.profit)};
`

export const RoiWrapper = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.colors.foreground};
  border-radius: 0.5rem;
  display: flex;
  font-size: 0.9375rem;
  height: 1.625rem;
  justify-content: center;
  padding: 0.3rem;
  width: 4.0625rem;
`

const RoiPercent: React.FC<Props> = ({ roi, style }) => {
  const percent = formatPercent(roi)
  const percentFloat = parseFloat(percent)
  const sign = getSign(percentFloat)
  return (
    <Wrapper sign={sign} style={style}>
      {percent}
    </Wrapper>
  )
}

export default RoiPercent
