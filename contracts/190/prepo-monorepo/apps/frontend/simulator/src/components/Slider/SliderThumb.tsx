import { Tooltip } from 'antd'
import React, { forwardRef } from 'react'
import styled from 'styled-components'
import { SupportedColor, trackColorToThemeColor } from './slider-utils'
import SliderThumbContents from './SliderThumbContents'

type TooltipProps = {
  isDynamicColorThumb: boolean
  dynamicColor: SupportedColor
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledThumb: any = styled.div`
  background-color: ${({ theme }): string => theme.colors.foreground};
  border: 1px solid ${({ theme }): string => theme.colors.subtitle};
  border-radius: 0.43rem;
  cursor: grab;
  height: 1.625rem;
  line-height: 25px;
  text-align: center;
  width: 0.875rem;
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ToolTipWrapper: any = styled(Tooltip)<TooltipProps>`
  display: flex;
  flex-direction: column;
  outline: none;

  ${({ theme, isDynamicColorThumb, dynamicColor }): string => {
    if (!isDynamicColorThumb) {
      return `.ant-tooltip-inner, .ant-tooltip-arrow-content {
        background: ${theme.colors.textPrimary};
        color: ${theme.colors.textSecondary};
      }`
    }

    const backgroundColor =
      dynamicColor !== 'neutral'
        ? trackColorToThemeColor(dynamicColor, theme)
        : theme.colors.subtitle

    return `.ant-tooltip-inner, .ant-tooltip-arrow-content {
        background: ${backgroundColor};
        color: ${theme.colors.textSecondary};
      }`
  }}
`

type Props = {
  index: number
  value: number
  numberFormatter: (n: number) => string
  tooltipLabels: [string, string] | undefined
  trackColor: SupportedColor
}

const SliderThumb: React.FC<Props> = forwardRef(
  ({ index, value, numberFormatter, tooltipLabels, trackColor, ...props }, ref) => {
    if (!tooltipLabels) {
      // eslint-disable-next-line react/jsx-props-no-spreading
      return <StyledThumb ref={ref} {...props} />
    }

    const leftThumb = index === 0
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
      <ToolTipWrapper
        key={index}
        isDynamicColorThumb={!leftThumb && trackColor !== 'neutral'}
        dynamicColor={trackColor}
      >
        <Tooltip
          key={index}
          placement={placement}
          title={contents}
          visible
          getPopupContainer={(triggerNode): HTMLElement => triggerNode}
        >
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <StyledThumb ref={ref} {...props} />
        </Tooltip>
      </ToolTipWrapper>
    )
  }
)

SliderThumb.displayName = 'SliderThumb'

export default SliderThumb
