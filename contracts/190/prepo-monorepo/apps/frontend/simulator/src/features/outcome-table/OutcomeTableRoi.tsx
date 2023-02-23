import React from 'react'
import styled from 'styled-components'
import RoiPercent from '../../components/RoiPercent'
import { spacingIncrement } from '../app/themes'

const ROIWrapper = styled.div<{ primary: boolean }>`
  float: right;
  text-align: ${({ primary }): string => (primary ? 'center' : 'right')};
`

const ROIContainer = styled.div<{ primary: boolean }>`
  background-color: ${({ theme, primary }): string =>
    primary ? theme.colors.foreground : 'transparent'};
  border-radius: 0.5rem;
  color: ${({ theme, primary }): string =>
    primary ? theme.colors.profit : theme.colors.textPrimary};
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  margin: 0 auto;
  padding: ${({ primary }): string => (primary ? '0.2rem' : '0')};
  width: 100%;

  span {
    padding-left: ${spacingIncrement(0.5)};
  }
`

type Props = { primary?: boolean; roi: number }

const OutcomeTableRoi: React.FC<Props> = ({ primary = false, roi }) => (
  <ROIWrapper primary={primary}>
    <ROIContainer primary={primary}>
      <RoiPercent roi={roi} />
    </ROIContainer>
  </ROIWrapper>
)

export default OutcomeTableRoi
