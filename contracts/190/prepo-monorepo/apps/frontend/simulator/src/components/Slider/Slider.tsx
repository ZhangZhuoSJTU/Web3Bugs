/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect } from 'react'
import { Col, Row } from 'antd'
import styled from 'styled-components'
import ReactSlider, { ReactSliderProps } from 'react-slider'
import { getColoredTrackPercentages, SupportedColor } from './slider-utils'
import SliderTrack from './SliderTrack'
import SliderThumb from './SliderThumb'
import SingleSliderTrack from './SingleSliderTrack'
import { spacingIncrement } from '../../features/app/themes'

type LabelPosition = 'top' | 'side'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
`

const RowWrapper = styled(Row)`
  margin: ${spacingIncrement(7)} 0;
  width: 100%;
`

const Top = styled.div`
  color: ${({ theme }): string => theme.colors.accent};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: normal;
  justify-content: space-between;
  width: 100%;
`

const Bottom = styled.div`
  width: 100%;
`

const Container = styled(ReactSlider)<{ labelPosition: LabelPosition }>`
  display: block;
  height: 1.6rem;
  width: 100%;
`

const LabelCol = styled(Col)`
  text-align: center;
`

const Label = styled.span`
  color: ${({ theme }): string => theme.colors.accent};
`

export type SliderValue = readonly [number, number] | number

type Props = ReactSliderProps<SliderValue> & {
  trackColor?: SupportedColor
  min: number
  max: number
  value: SliderValue
  onChange: (value: SliderValue, index: number) => void
  labelPosition?: LabelPosition
  step?: number
  minDistance?: number
  numberFormatter?: (n: number) => string
  tooltipLabels?: [string, string]
}

const Slider: React.FC<Props> = ({
  min,
  max,
  value,
  trackColor = 'neutral',
  onChange,
  labelPosition = 'top',
  step = 1,
  minDistance = 0,
  numberFormatter = (n: number): string => n.toString(),
  tooltipLabels,
}) => {
  // Trigger a window resize on mount which will ensure the ReactSlider tracks
  // and handles stay aligned correctly. Without this trick, on some screen
  // widths if you switch to advanced mode PRIOR to the initial render the
  // alignments will be messed up.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, react/no-unstable-nested-components
  const Track: React.FC = (props: any, { index }: { index: number }) => {
    if (!Array.isArray(value)) {
      return <SingleSliderTrack index={index} {...props} />
    }

    const [left, right] = getColoredTrackPercentages(min, max, value[0], value[1])

    return (
      <SliderTrack
        index={index}
        trackColor={trackColor}
        coloredTrackLeftPercent={left}
        coloredTrackRightPercent={right}
        {...props}
      />
    )
  }

  const renderThumb = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any,
    { index, valueNow }: { index: number; valueNow: number }
  ): JSX.Element => (
    <SliderThumb
      index={index}
      value={valueNow}
      numberFormatter={numberFormatter}
      tooltipLabels={tooltipLabels}
      trackColor={trackColor}
      {...props}
    />
  )

  const onSliderChange = (_value: number | readonly number[], index: number): void => {
    onChange(_value as SliderValue, index)
  }

  if (labelPosition === 'top') {
    return (
      <Wrapper>
        <Top>
          <span>{numberFormatter(min)}</span>
          <span>{numberFormatter(max)}</span>
        </Top>
        <Bottom>
          <Container
            renderTrack={Track}
            renderThumb={renderThumb}
            min={min}
            max={max}
            value={value}
            onChange={onSliderChange}
            minDistance={minDistance}
            step={step}
            labelPosition={labelPosition}
          />
        </Bottom>
      </Wrapper>
    )
  }

  return (
    <RowWrapper>
      <LabelCol xs={5} md={3}>
        <Label>{numberFormatter(min)}</Label>
      </LabelCol>

      <Col xs={14} md={18}>
        <Container
          renderTrack={Track}
          renderThumb={renderThumb}
          min={min}
          max={max}
          value={value}
          onChange={onSliderChange}
          minDistance={minDistance}
          step={step}
          labelPosition={labelPosition}
        />
      </Col>

      <LabelCol xs={5} md={3}>
        <Label>{numberFormatter(max)}</Label>
      </LabelCol>
    </RowWrapper>
  )
}

export default Slider
