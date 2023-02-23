/* eslint-disable react/jsx-props-no-spreading */
import { useEffect, useCallback } from 'react'
import { Row } from 'antd'
import styled, { Color } from 'styled-components'
import ReactSlider, { ReactSliderProps } from 'react-slider'
import { centered, spacingIncrement } from 'prepo-ui'
import { getColoredTrackPercentages } from './utils'
import SliderTrack from './DualTrack'
import SliderThumb from './Thumb'
import SingleSliderTrack from './SingleTrack'

type LabelPosition = 'top' | 'side' | 'none'

type LabelSpacing = 'dense' | 'normal' | 'none'

export type ThumbStyle = 'pill' | 'line'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
`

const RowWrapper = styled(Row)`
  ${centered}
  flex-wrap: nowrap;
`

const Top = styled.div`
  color: ${({ theme }): string => theme.color.accent1};
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
  height: 1.75rem;
  width: 100%;
`

const Label = styled.span<{ marginLeft?: number; marginRight?: number }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin: ${({ marginRight = 0, marginLeft = 0 }): string =>
    `0 ${spacingIncrement(marginRight)} 0 ${spacingIncrement(marginLeft)}`};
  text-align: center;
`

export type SliderValue = readonly [number, number] | number

type Props = ReactSliderProps<SliderValue> & {
  trackColor?: keyof Color
  min: number
  max: number
  value: SliderValue
  onChange: (value: SliderValue, index: number) => void
  labelPosition?: LabelPosition
  step?: number
  minDistance?: number
  numberFormatter?: (n: number) => string
  tooltipLabels?: [string, string]
  thumbStyles?: [ThumbStyle, ThumbStyle]
  tooltipBackgrounds?: [keyof Color, keyof Color]
  labelSpacing?: LabelSpacing
}

const Slider: React.FC<Props> = ({
  min,
  max,
  value,
  trackColor = 'success',
  onChange,
  labelPosition = 'top',
  step = 1,
  minDistance = 0,
  numberFormatter = (n: number): string => n.toString(),
  thumbStyles = ['pill', 'pill'],
  tooltipBackgrounds = ['secondary', 'secondary'],
  tooltipLabels,
  labelSpacing = 'none',
}) => {
  let labelSpacingValue = 0
  if (labelSpacing === 'dense') {
    labelSpacingValue = 3
  }
  if (labelSpacing === 'normal') {
    labelSpacingValue = 14
  }
  // Trigger a window resize on mount which will ensure the ReactSlider tracks
  // and thumbs are aligned correctly. Without this trick, on some screen
  // widths the thumb alignments will be messed up.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [])

  // memoized as fix for eslint rule react/no-unstable-nested-components
  const Track = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any, { index }: { index: number }): React.ReactElement => {
      if (!Array.isArray(value)) {
        return <SingleSliderTrack index={index} trackColor={trackColor} {...props} />
      }

      const [left, right] = getColoredTrackPercentages(min, max, value[0], value[1])

      return (
        <SliderTrack
          index={index}
          trackColor={trackColor}
          coloredTrackLeftPercent={left}
          coloredTrackRightPercent={right}
          thumbStyles={thumbStyles}
          {...props}
        />
      )
    },
    [max, min, thumbStyles, trackColor, value]
  )

  const renderThumb = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any,
    { index, valueNow }: { index: number; valueNow: number }
  ): React.ReactElement => (
    <SliderThumb
      index={index}
      value={valueNow}
      numberFormatter={numberFormatter}
      tooltipLabels={tooltipLabels}
      tooltipBackgrounds={tooltipBackgrounds}
      trackColor={trackColor}
      thumbStyles={thumbStyles}
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
      {labelPosition !== 'none' && (
        <Label marginRight={labelSpacingValue}>{numberFormatter(min)}</Label>
      )}
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
      {labelPosition !== 'none' && (
        <Label marginLeft={labelSpacingValue}>{numberFormatter(max)}</Label>
      )}
    </RowWrapper>
  )
}

export default Slider
