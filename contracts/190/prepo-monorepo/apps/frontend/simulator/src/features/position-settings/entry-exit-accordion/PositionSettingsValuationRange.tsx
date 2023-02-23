import React from 'react'
import styled from 'styled-components'
import { Row, Alert } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { actions } from '../../position/position-slice'
import { spacingIncrement } from '../../app/themes'
import InfoTooltipIcon from '../../icons/InfoTooltipIcon'
import Input from '../../../components/Input'
import { Bounds } from '../../position/markets'
import { forceNumInRange } from '../../../helpers'

const Wrapper = styled.div`
  margin-top: ${spacingIncrement(2)};
`

const Title = styled.div`
  font-weight: 800;
  margin-bottom: ${spacingIncrement(1)};
`

const InputRow = styled(Row)`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-between;
`

const Gap = styled.div`
  padding: 0 1rem;
`

const InputWrapper = styled.div``

const getErrorMessage = ({ floor, ceil }: Bounds): string | null => {
  if (floor >= ceil) return 'Floor must be less than Ceiling.'
  return null
}

const InputLabel = styled.span`
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  margin-left: ${spacingIncrement(1)};
`

const StyledInput = styled(Input)<{ error?: boolean }>`
  .ant-input {
    ${({ error, theme }): string => {
      if (error) return `border: 2px solid ${theme.colors.loss};`
      return ''
    }}
  }
`

const StyledAlert = styled(Alert)`
  && {
    align-items: center;
    padding: 10px 10px 10px 24px;

    .ant-alert-description {
      display: none;
    }

    .ant-alert-message {
      font-size: ${({ theme }): string => theme.fontSize.xsm};
      margin-bottom: 0;
    }
  }
`

const MAX_VAL = 500
const MIN_VAL = 0

const PositionSettingsValuationRange: React.FC = () => {
  const valuationBounds = useAppSelector((state) => state.position.market?.bounds.valuation)
  const mode = useAppSelector((state) => state.position.ui.mode)
  const dispatch = useAppDispatch()
  if (!valuationBounds || mode === 'basic') return null
  const { floor, ceil } = valuationBounds

  const onFloorChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const num = Number(e.target.value)
    dispatch(
      actions.marketValuationRangeChanged({
        floor: forceNumInRange(num, MIN_VAL, MAX_VAL),
        ceil,
      })
    )
  }

  const onCeilChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const num = Number(e.target.value)
    dispatch(
      actions.marketValuationRangeChanged({
        floor,
        ceil: forceNumInRange(num, MIN_VAL, MAX_VAL),
      })
    )
  }

  const errorMessage = getErrorMessage(valuationBounds)

  const highlight = true

  return (
    <Wrapper>
      <Title>
        Valuation Range{' '}
        <InfoTooltipIcon text="Each market allows for speculating on a valuation within a fixed floor-to-ceiling range. A tighter valuation range results in higher leverage for traders. Docs coming soon." />
      </Title>
      <InputRow>
        <InputWrapper>
          <InputLabel>Floor ($B)</InputLabel>
          <StyledInput
            textCentered
            value={floor.toString()}
            onChange={onFloorChange}
            highlight={highlight}
            error={!!errorMessage}
            type="number"
          />
        </InputWrapper>
        <Gap />
        <InputWrapper>
          <InputLabel>Ceiling ($B)</InputLabel>
          <StyledInput
            textCentered
            value={ceil.toString()}
            onChange={onCeilChange}
            highlight
            error={!!errorMessage}
            type="number"
          />
        </InputWrapper>
      </InputRow>
      {errorMessage ? (
        <StyledAlert type="error" description="jsdk" message={errorMessage} showIcon />
      ) : null}
    </Wrapper>
  )
}

export default PositionSettingsValuationRange
