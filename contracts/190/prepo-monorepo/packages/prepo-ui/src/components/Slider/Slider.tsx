/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { Row } from 'antd'
import styled, { Color, SimpleInterpolation } from 'styled-components'
import ReactSlider, { ReactSliderProps } from 'react-slider'
import { getResponsiveHeight } from './slider-utils'
import SliderTrack from './DualTrack'
import SliderThumb from './Thumb'
import SingleSliderTrack from './SingleTrack'
import { SLIDER_DEFAULT_SETTINGS } from './slider-settings'
import { centered, spacingIncrement } from '../../common-utils'

type LabelPosition = 'top' | 'side' | 'none'

type LabelSpacing = 'dense' | 'normal' | 'none'

export type Thickness = 'small' | 'normal'

export type ThumbStyle = 'pill' | 'line' | 'circle'

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
  position: relative;
`

const Top = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: normal;
  justify-content: space-between;
  margin-bottom: ${spacingIncrement(8)};
  width: 100%;
`

const Bottom = styled.div`
  position: relative;
  width: 100%;
`

const Container = styled(ReactSlider)<{ labelPosition: LabelPosition; thickness?: Thickness }>`
  display: block;
  width: 100%;
  ${({ thickness }): SimpleInterpolation => getResponsiveHeight(thickness)}
`
const Backdrop = styled.div<{ $left: string; $width: string }>`
  height: 100%;
  left: ${({ $left }): string => $left};
  position: absolute;
  top: 0;
  width: ${({ $width }): string => $width};
  z-index: 1;
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
  focusColor?: keyof Color
  trackUnderlyingColor?: keyof Color
  min: number | string
  max: number | string
  value?: SliderValue
  onChange?: (value: SliderValue, index: number) => void
  labelPosition?: LabelPosition
  step?: number
  numberFormatter?: (n: number) => string
  tooltipLabels?: [string, string]
  thumbStyles?: [ThumbStyle, ThumbStyle]
  thumbBorder?: string
  tooltipBackgrounds?: [keyof Color, keyof Color]
  labelSpacing?: LabelSpacing
  handlesCanPassThrough?: boolean
  thickness?: Thickness
  disableSmallThumb?: boolean
}

const Slider: React.FC<Props> = ({
  min,
  max,
  value,
  trackColor = SLIDER_DEFAULT_SETTINGS.trackColor,
  focusColor = SLIDER_DEFAULT_SETTINGS.focusColor,
  trackUnderlyingColor = SLIDER_DEFAULT_SETTINGS.trackUnderlyingColor,
  onChange,
  thickness = 'normal',
  labelPosition = 'top',
  step = 1,
  numberFormatter = (n: number | string): string => (typeof n === 'number' ? n.toString() : n),
  thumbStyles = ['pill', 'pill'],
  thumbBorder = 'none',
  tooltipBackgrounds = ['success', 'sliderTooltipBackground'],
  tooltipLabels,
  labelSpacing = 'none',
  handlesCanPassThrough = false,
  disabled = false,
  disableSmallThumb = false,
}) => {
  const thumbsRef = useRef<HTMLDivElement[]>([])
  const [localValue, setLocalValue] = useState<SliderValue>(value as SliderValue)
  const [backdropState, setBackdropState] = useState<{ left: string; width: string }>({
    left: '0',
    width: '0',
  })
  const [dualTrackProgress, setDualTrackProgress] = useState({
    left: 0,
    right: 0,
  })

  let labelSpacingValue = 0
  if (labelSpacing === 'dense') {
    labelSpacingValue = 3
  }
  if (labelSpacing === 'normal') {
    labelSpacingValue = 14
  }

  const singleThumb = useMemo(() => !Array.isArray(localValue), [localValue])
  // Trigger a window resize on mount which will ensure the ReactSlider tracks
  // and thumbs are aligned correctly. Without this trick, on some screen
  // widths the thumb alignments will be messed up.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [min, max, value])

  // // update slider when value is changed from parent component
  useEffect(() => {
    if (localValue !== value) setLocalValue(value as SliderValue)
  }, [localValue, value])

  const sliderRef = useRef<ReactSlider>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!sliderRef.current) {
      return
    }
    const ref = sliderRef.current as unknown as { slider: HTMLDivElement }
    const totalWidth = ref.slider.clientWidth

    const leftTick = dualTrackProgress.left
    const rightTick = totalWidth - dualTrackProgress.right
    const middlePoint = (leftTick + rightTick) / 2
    const offsetLeft = labelRef.current ? labelRef.current.clientWidth + labelSpacingValue : 0

    if (Array.isArray(localValue) && localValue[1] >= localValue[0]) {
      setBackdropState({ left: `${offsetLeft}px`, width: `${middlePoint}px` })
    } else {
      setBackdropState({
        left: `${middlePoint + offsetLeft}px`,
        width: `${totalWidth - middlePoint}px`,
      })
    }
  }, [dualTrackProgress, labelSpacingValue, localValue])

  // memoized as fix for eslint rule react/no-unstable-nested-components
  const Track = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any, { index }: { index: number }): React.ReactElement => {
      if (singleThumb) {
        return (
          <SingleSliderTrack
            index={index}
            trackColor={trackColor}
            trackUnderlyingColor={trackUnderlyingColor}
            thickness={thickness}
            {...props}
          />
        )
      }

      const { left, right } = dualTrackProgress

      return (
        <SliderTrack
          index={index}
          trackColor={trackColor}
          trackUnderlyingColor={trackUnderlyingColor}
          coloredTrackLeftPercent={left}
          coloredTrackRightPercent={right}
          thickness={thickness}
          thumbStyles={thumbStyles}
          {...props}
        />
      )
    },
    [singleThumb, dualTrackProgress, trackColor, trackUnderlyingColor, thickness, thumbStyles]
  )

  const updateDualTrackProgress = useCallback((): void => {
    if (thumbsRef.current.length === 2) {
      const thumbOne = thumbsRef.current[0]
      const thumbTwo = thumbsRef.current[1]
      if (thumbOne && thumbTwo) {
        const parentWidth = thumbTwo?.offsetParent?.clientWidth ?? 0
        const thumbOneCenter = thumbOne.clientWidth / 2
        const thumbTwoCenter = thumbTwo.clientWidth / 2
        const thumbOneLeft = thumbOne.offsetLeft
        const thumbTwoLeft = thumbTwo.offsetLeft
        let left = thumbOneLeft + thumbOneCenter
        let right = parentWidth - thumbTwoLeft - thumbTwoCenter
        if (thumbOneLeft + thumbOneCenter > thumbTwoLeft - thumbTwoCenter) {
          left = thumbTwoLeft + thumbTwoCenter
          right = parentWidth - thumbOneLeft - thumbOneCenter
        }

        if (dualTrackProgress.left !== left || dualTrackProgress.right !== right) {
          setDualTrackProgress({ left, right })
        }
      }
    }
  }, [dualTrackProgress.left, dualTrackProgress.right])

  const updateThumbRef = (el: HTMLDivElement, index: number): void => {
    thumbsRef.current[index] = el
    // initialize left right position on track
    updateDualTrackProgress()
  }

  const renderThumb = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any,
    { index, valueNow }: { index: number; valueNow: number }
  ): React.ReactElement => (
    <SliderThumb
      customRef={(el): void => updateThumbRef(el as HTMLDivElement, index)}
      index={index}
      value={valueNow}
      numberFormatter={numberFormatter}
      tooltipLabels={tooltipLabels}
      tooltipBackgrounds={tooltipBackgrounds}
      trackColor={trackColor}
      focusColor={focusColor}
      trackUnderlyingColor={trackUnderlyingColor}
      thumbStyles={thumbStyles}
      border={thumbBorder}
      thickness={thickness}
      {...props}
    />
  )

  const onSliderChange = (_value: number | readonly number[], index: number): void => {
    updateDualTrackProgress()
    if (typeof _value === 'number' || Array.isArray(_value)) {
      setLocalValue(_value as SliderValue)
    }
    if (onChange) {
      onChange(_value as SliderValue, index)
    }
  }

  const renderContainer = (
    <Container
      ref={sliderRef as React.Ref<ReactSlider<number | readonly number[]>> | undefined}
      renderTrack={Track}
      renderThumb={renderThumb}
      min={min}
      max={max}
      disabled={disabled}
      value={localValue}
      onChange={onSliderChange}
      // this is the largest possible number in Javascript
      minDistance={handlesCanPassThrough ? -999999999999999 : 0}
      step={step === 0 ? 1 : step}
      thickness={thickness}
      labelPosition={labelPosition}
    />
  )

  if (labelPosition === 'top') {
    return (
      <Wrapper>
        <Top>
          <Label>{numberFormatter(min)}</Label>
          <Label>{numberFormatter(max)}</Label>
        </Top>
        <Bottom>
          {renderContainer}
          {disableSmallThumb && (
            <Backdrop $left={backdropState.left} $width={backdropState.width} />
          )}
        </Bottom>
      </Wrapper>
    )
  }

  return (
    <RowWrapper>
      {labelPosition !== 'none' && (
        <Label ref={labelRef} marginRight={labelSpacingValue}>
          {numberFormatter(min)}
        </Label>
      )}
      {renderContainer}
      {disableSmallThumb && <Backdrop $left={backdropState.left} $width={backdropState.width} />}
      {labelPosition !== 'none' && (
        <Label marginLeft={labelSpacingValue}>{numberFormatter(max)}</Label>
      )}
    </RowWrapper>
  )
}

export default Slider
