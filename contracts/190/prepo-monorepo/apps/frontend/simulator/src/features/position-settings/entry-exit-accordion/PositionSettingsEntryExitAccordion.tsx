import React, { useLayoutEffect, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useSelector } from 'react-redux'
import PositionSettingsCaptialEfficiency from './PositionSettingsCapitalEfficiency'
import PositionSettingsEntryExitSummary from './PositionSettingsEntryExitSummary'
import PositionSettingsEntryExit from './PositionSettingsEntryExit'
import { spacingIncrement } from '../../app/themes'
import Accordion from '../../../components/Accordion'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { media } from '../../../utils/media'
import { actions } from '../../position/position-slice'
import { selectScenarioBounds } from '../../position/scenario-bounds-selector'
import { cardPadding } from '../../../components/Card'
import Button from '../../../components/Button'
import MarketVisualisation from '../MarketVisualisation'
import MarketPayoutRange from '../MarketPayoutRange'

const HEIGHT_PIXELS_TOP_TO_MARKET_VISUALIZATION = 230

const scrollBarStyles = css`
  ::-webkit-scrollbar {
    width: 20px;
  }
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-clip: content-box;
    background-color: #d6dee1;
    border: 6px solid transparent;
    border-radius: 20px;
    :hover {
      background-color: #a8bbbf;
    }
  }
`

const Wrapper = styled(Accordion)`
  margin-top: ${spacingIncrement(4)};
`

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${spacingIncrement(4)};
  padding-bottom: ${spacingIncrement(2)};
  width: 100%;

  ${media.lg`
    display: inline-grid;
  `};
`

const Top = styled.div`
  ${cardPadding};
  height: 100%;
  padding-bottom: 0 !important;
  padding-top: 0 !important;
`
const Scrollable = styled.div<{
  shouldShowMarketVisualisation: boolean
  visHeight: number
}>`
  ${scrollBarStyles}
  ${cardPadding};
  overflow: auto;
  overflow: overlay;
  ${({ shouldShowMarketVisualisation, visHeight }): string => {
    if (shouldShowMarketVisualisation)
      return `
        height: calc(100vh - ${visHeight + HEIGHT_PIXELS_TOP_TO_MARKET_VISUALIZATION}px);

      padding-top: 0 !important;
    `
    return `
      height: 100%;
    `
  }}
`

const PositionSettingsEntryExitAccordion: React.FC = () => {
  const visRef = useRef<HTMLCanvasElement | null>(null)
  const [visHeight, setVisHeight] = useState(0)
  const position = useAppSelector((state) => state.position)
  const mode = useAppSelector((state) => state.position.ui.mode)
  const scenarioBounds = useSelector(selectScenarioBounds)
  const dispatch = useAppDispatch()

  // TODO switch to using a callback ref so we can set height only
  // when the ref mounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (visRef.current && visRef.current.offsetHeight !== visHeight) {
      setVisHeight(visRef.current.offsetHeight)
    }
  })

  const positionOrLPSelected = Boolean(position.direction) || position.type === 'lp'

  const shouldShowButton = position.market && scenarioBounds
  const buttonText = position.ui.hasCompletedPositionSettings ? 'Save' : 'Continue'
  const shouldShowMarketVisualisation = mode === 'advanced'

  if (!positionOrLPSelected) return null

  return (
    <Wrapper
      noPadding
      show={position.ui.positionAcordionEntryExitState === 'open'}
      summary={<PositionSettingsEntryExitSummary />}
      onEdit={(): void => {
        dispatch(actions.positionAccordionEntryExitStateChanged('open'))

        // Closes the other accordion
        dispatch(actions.positionAccordionStateChanged('closed'))
      }}
    >
      {shouldShowMarketVisualisation && (
        <Top>
          <MarketVisualisation ref={visRef} />
        </Top>
      )}
      <Scrollable
        shouldShowMarketVisualisation={shouldShowMarketVisualisation}
        visHeight={visHeight}
      >
        <PositionSettingsEntryExit />
        <MarketPayoutRange />
        <PositionSettingsCaptialEfficiency />

        {shouldShowButton && (
          <Footer>
            <Button
              type="primary"
              block
              onClick={(): void => {
                dispatch(actions.entryExitCompleted())
                dispatch(actions.positionAccordionEntryExitStateChanged('closed'))
              }}
            >
              {buttonText}
            </Button>
          </Footer>
        )}
      </Scrollable>
    </Wrapper>
  )
}

export default PositionSettingsEntryExitAccordion
