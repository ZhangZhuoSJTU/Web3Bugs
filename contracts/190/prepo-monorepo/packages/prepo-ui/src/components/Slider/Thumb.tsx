/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState, forwardRef } from 'react'
import { Tooltip } from 'antd'
import styled, { Color, css, FlattenSimpleInterpolation } from 'styled-components'
import { Thickness, ThumbStyle } from './Slider'
import SliderThumbContents from './ThumbContents'
import { SLIDER_DEFAULT_SETTINGS } from './slider-settings'
import { absoluteCenterY, media, spacingIncrement } from '../../common-utils'

type StyledThumbProps = {
  border?: string
  thumbStyle?: ThumbStyle
  trackColor?: keyof Color
  focusColor?: keyof Color
  thickness?: Thickness
}

const StyledThumb = styled.div<StyledThumbProps>`
  ${absoluteCenterY}
  ${({ border, thumbStyle, theme, trackColor, focusColor }): FlattenSimpleInterpolation => {
    if (thumbStyle === 'pill')
      return css`
        background-color: ${theme.color.white};
        border: ${border};
        border-radius: 7px;
        box-shadow: 0px 5px 8px rgba(0, 0, 0, 0.15);
        cursor: grab;
        height: 1.75rem;
        text-align: center;
        width: 0.8rem;
        :focus-visible {
          outline-color: ${focusColor
            ? theme.color[focusColor]
            : SLIDER_DEFAULT_SETTINGS.focusColor};
        }
      `

    if (thumbStyle === 'circle')
      return css`
        background-color: ${trackColor
          ? theme.color[trackColor]
          : SLIDER_DEFAULT_SETTINGS.trackColor};
        border-radius: 1rem;
        box-shadow: 0px 5px 8px rgba(0, 0, 0, 0.15);
        cursor: grab;
        height: ${spacingIncrement(20)};
        width: ${spacingIncrement(20)};
        :focus-visible {
          outline-color: ${focusColor
            ? theme.color[focusColor]
            : SLIDER_DEFAULT_SETTINGS.focusColor};
        }
        ${media.desktop`
          height: ${spacingIncrement(32)};
          width: ${spacingIncrement(32)};
        `}
      `

    return css`
      background-color: ${theme.color.secondary};
      height: 1.75rem;
      pointer-events: none;
      width: 2px;
    `
  }}
`

const ToolTipWrapper = styled(Tooltip)<{ tooltipBackground: keyof Color }>`
  display: flex;
  flex-direction: column;
  outline: none;

  .ant-tooltip-inner,
  .ant-tooltip-arrow-content {
    background: ${({ theme, tooltipBackground }): string => theme.color[tooltipBackground]};
  }
`

type Props = {
  customRef?: React.ForwardedRef<HTMLDivElement>
  index: number
  value: number
  numberFormatter: (n: number) => string
  tooltipLabels: [string, string] | undefined
  thumbStyles: [ThumbStyle, ThumbStyle]
  tooltipBackgrounds: [keyof Color, keyof Color]
} & StyledThumbProps

const SliderThumb: React.FC<Props> = forwardRef(
  (
    {
      customRef,
      index,
      value,
      numberFormatter,
      tooltipLabels,
      thumbStyles,
      tooltipBackgrounds,
      ...props
    },
    ref: React.ForwardedRef<HTMLDivElement>
  ) => {
    // Solves strange issue https://github.com/vercel/next.js/discussions/17443
    // Issue was causing ThumbTypes to render incorrectly when they are ['line', 'pill']
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
      setMounted(true)
    }, [])
    if (!mounted) return null

    const thumbStyle = thumbStyles[index]
    const tooltipBackground = tooltipBackgrounds[index]
    const leftThumb = index === 0

    const updateRef = (el: HTMLDivElement): void => {
      if (typeof ref === 'function') ref(el)
      // we need this customRef to get position of thumb, to calculate position of dual thumb track
      // default ref is used by react-slider to make it functional
      if (typeof customRef === 'function') customRef(el)
    }

    if (!tooltipLabels) {
      return <StyledThumb ref={updateRef} thumbStyle={thumbStyle} {...props} />
    }

    const contents = (
      <SliderThumbContents
        value={value}
        direction={leftThumb ? 'column' : 'column-reverse'}
        label={leftThumb ? tooltipLabels[0] : tooltipLabels[1]}
        numberFormatter={numberFormatter}
      />
    )
    const placement = leftThumb ? 'top' : 'bottom'

    return (
      <ToolTipWrapper overlay={null} key={index} tooltipBackground={tooltipBackground}>
        <Tooltip
          key={index}
          placement={placement}
          title={contents}
          visible
          getPopupContainer={(triggerNode): HTMLElement => triggerNode}
        >
          <StyledThumb ref={updateRef} thumbStyle={thumbStyle} {...props} />
        </Tooltip>
      </ToolTipWrapper>
    )
  }
)

SliderThumb.displayName = 'SliderThumb'

export default SliderThumb
