import { useEffect, useState, forwardRef } from 'react'
import { Tooltip } from 'antd'
import styled, { Color } from 'styled-components'
import { ThumbStyle } from './Slider'
import SliderThumbContents from './ThumbContents'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledThumb: any = styled.div<{ thumbStyle: ThumbStyle }>`
  ${({ thumbStyle, theme }): string => {
    if (thumbStyle === 'pill')
      return `
        background-color: ${theme.color.white};
        border-radius: 7px;
        cursor: grab;
        height: 1.75rem;
        text-align: center;
        width: 0.8rem;
        :focus-visible {
          outline-color: ${theme.color.success};
        }
      box-shadow: 0px 5px 8px rgba(0, 0, 0, 0.15);
    `
    return `
      height: 1.75rem;
      pointer-events: none;
      width: 2px;
      background-color: ${theme.color.secondary};
    `
  }}
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ToolTipWrapper: any = styled(Tooltip)<{ tooltipBackground: keyof Color }>`
  display: flex;
  flex-direction: column;
  outline: none;

  .ant-tooltip-inner,
  .ant-tooltip-arrow-content {
    background: ${({ theme, tooltipBackground }): string => theme.color[tooltipBackground]};
  }
`

type Props = {
  index: number
  value: number
  numberFormatter: (n: number) => string
  tooltipLabels: [string, string] | undefined
  thumbStyles: [ThumbStyle, ThumbStyle]
  tooltipBackgrounds: [keyof Color, keyof Color]
}

const SliderThumb: React.FC<Props> = forwardRef(
  (
    { index, value, numberFormatter, tooltipLabels, thumbStyles, tooltipBackgrounds, ...props },
    ref
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

    if (!tooltipLabels) {
      // eslint-disable-next-line react/jsx-props-no-spreading
      return <StyledThumb ref={ref} thumbStyle={thumbStyle} {...props} />
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
      <ToolTipWrapper key={index} tooltipBackground={tooltipBackground}>
        <Tooltip
          key={index}
          placement={placement}
          title={contents}
          visible
          getPopupContainer={(triggerNode): HTMLElement => triggerNode}
        >
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <StyledThumb ref={ref} thumbStyle={thumbStyle} {...props} />
        </Tooltip>
      </ToolTipWrapper>
    )
  }
)

SliderThumb.displayName = 'SliderThumb'

export default SliderThumb
