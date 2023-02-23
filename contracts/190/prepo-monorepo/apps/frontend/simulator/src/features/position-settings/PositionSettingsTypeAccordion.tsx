import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Radio } from 'antd'
import MarketHoldingPeriod from './MarketHoldingPeriod'
import PositionSummaryHeader from './PositionSummaryHeader'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { actions, Direction, Type } from '../position/position-slice'
import { media } from '../../utils/media'
import themes, { spacingIncrement } from '../app/themes'
import RadioGroup from '../../components/RadioGroup'
import LongIcon from '../icons/LongIcon'
import ShortIcon from '../icons/ShortIcon'
import Accordion from '../../components/Accordion'
import { cardPadding } from '../../components/Card'
import Button from '../../components/Button'
import CustomRadio from '../../components/Radio'

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${spacingIncrement(4)};
  width: 100%;

  ${media.lg`
    margin-top: ${spacingIncrement(1)};
    display: inline-grid;
  `};
`

const LabelIconWrapper = styled.div`
  display: flex;
`

const LabelIconImage = styled.div`
  margin-left: ${spacingIncrement(1)};
  width: 1rem;
`

const LabelIcon: React.FC<{ icon: React.ReactNode }> = ({ icon, children }) => (
  <LabelIconWrapper>
    {children} <LabelIconImage>{icon}</LabelIconImage>
  </LabelIconWrapper>
)

const BodyWrapper = styled.div`
  ${cardPadding};
`

const PositionSettingsTypeAccordion: React.FC = () => {
  const [traderType, setSelectedTraderType] = useState<Type | undefined>(undefined)
  const [positionDirection, setPositionDirection] = useState<Direction | undefined>(undefined)
  const position = useAppSelector((state) => state.position)
  const dispatch = useAppDispatch()

  const isTrader = traderType === 'trader'
  const isLP = traderType === 'lp'

  const positionAsTraderCompleted = isTrader && positionDirection
  const positionAsLPCompleted = isLP

  const canContinue = positionAsTraderCompleted || positionAsLPCompleted
  const buttonText = position.ui.hasCompletedPositionSettings ? 'Save' : 'Continue'

  useEffect(() => {
    // Resets local state when simulator is restarted
    if (position.type === null) {
      setSelectedTraderType(undefined)
      setPositionDirection(undefined)
    }
  }, [position.type])

  useEffect(() => {
    dispatch(actions.setCompletePositionSettings(Boolean(canContinue)))
  }, [dispatch, canContinue])

  return (
    <Accordion
      noPadding
      summary={<PositionSummaryHeader />}
      show={position.ui.positionAccordionSettingsState === 'open'}
      onEdit={(): void => {
        dispatch(actions.positionAccordionStateChanged('open'))

        // Closes the other accordion
        dispatch(actions.positionAccordionEntryExitStateChanged('closed'))
      }}
    >
      <BodyWrapper>
        <RadioGroup
          label="I am a..."
          onChange={(e): void => {
            if (e.target.value === 'lp') {
              setPositionDirection(undefined)
            }

            setSelectedTraderType(e.target.value)
          }}
          value={traderType}
        >
          <Radio value="trader">Trader</Radio>
          <Radio value="lp">LP</Radio>
        </RadioGroup>
        {!isLP && Boolean(traderType) && (
          <RadioGroup
            label="I want to go..."
            onChange={(e): void => {
              setPositionDirection(e.target.value)
            }}
            value={positionDirection}
            disabled={!isTrader}
          >
            <CustomRadio value="long" color={themes.standard.colors.profit}>
              <LabelIcon icon={<LongIcon disabled={!isTrader} />}>Long</LabelIcon>
            </CustomRadio>
            <CustomRadio value="short" color={themes.standard.colors.loss}>
              <LabelIcon icon={<ShortIcon disabled={!isTrader} />}>Short</LabelIcon>
            </CustomRadio>
          </RadioGroup>
        )}

        <MarketHoldingPeriod />

        {canContinue && (
          <Footer>
            <Button
              type="primary"
              block
              onClick={(): void => {
                dispatch(actions.positionAccordionStateChanged('closed'))
                dispatch(actions.positionSettingsCompleted())
                dispatch(actions.typeChanged(traderType))

                if (positionDirection) {
                  dispatch(actions.directionChanged(positionDirection))
                }
              }}
            >
              {buttonText}
            </Button>
          </Footer>
        )}
      </BodyWrapper>
    </Accordion>
  )
}

export default PositionSettingsTypeAccordion
