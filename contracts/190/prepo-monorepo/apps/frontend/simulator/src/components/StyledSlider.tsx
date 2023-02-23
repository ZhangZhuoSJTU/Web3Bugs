/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable no-param-reassign */

import React, { Component } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Slider, SliderSingleProps } from 'antd'
import styled from 'styled-components'

function showTooltip(tooltip: HTMLElement | null): void {
  if (tooltip) tooltip.style.opacity = '1'
}
function hideTooltip(tooltip: HTMLElement | null): void {
  if (tooltip) tooltip.style.opacity = '0'
}
function focusOnWrapper(document: Document, wrapperId: string): void {
  const wrapper: HTMLElement = document.getElementById(wrapperId) as HTMLElement
  wrapper.focus()
}

export default class StyledSlider extends Component<
  SliderSingleProps,
  {
    tooltip: HTMLElement | null
    touchingSlider: boolean
    touchDevice: boolean
    wrapperId: string
  }
> {
  constructor(props: SliderSingleProps) {
    super(props)
    // @ts-ignore
    const touchDevice = Boolean('ontouchstart' in window || navigator.msMaxTouchPoints)
    this.state = {
      touchDevice,
      tooltip: null,
      touchingSlider: false,
      wrapperId: uuidv4(),
    }
  }

  // onTouchStart is broken with version of rc-slider use by antd
  // manually add handler so touch works correctly on mobile
  componentDidMount(): void {
    const wrapper: HTMLElement = document.getElementById(this.state.wrapperId) as HTMLElement
    const slider = wrapper.children.item(0) as HTMLElement
    if (slider) this.setSliderTouchEvents(slider, this.state.tooltip)
  }

  // Manually set handle touch events to get box-shadow working on mobile
  // ReactDOM touch events not working with antd slider
  setSliderTouchEvents(slider: HTMLElement, tooltip: HTMLElement | null): void {
    slider.ontouchstart = (): void => {
      this.setState({ touchingSlider: true })
      showTooltip(tooltip)
    }
    slider.ontouchend = (): void => {
      this.setState({ touchingSlider: false })
      // Focus on the outer wrapper, so if user ends touch
      // they will no longer be dragging slider when they touch
      // elsewhere on the device
      setTimeout(() => {
        focusOnWrapper(document, this.state.wrapperId)
      }, 10)
      hideTooltip(tooltip)
    }
    slider.onmouseenter = (): void => {
      showTooltip(this.state.tooltip)
    }
    slider.onmouseleave = (): void => {
      hideTooltip(this.state.tooltip)
    }
    // Focus on the outer wrapper, so if user clicks and drags on the slider
    // while already focusing on the slider the handle will still drag.
    // Doesn't work without setTimeout
    slider.onmouseup = (): void => {
      setTimeout(() => {
        focusOnWrapper(document, this.state.wrapperId)
      }, 10)
    }
  }

  render(): JSX.Element {
    return (
      <Wrapper id={this.state.wrapperId} tabIndex={-1}>
        <StyledAntdSlider
          touchingSlider={this.state.touchingSlider}
          touchDevice={this.state.touchDevice}
          tooltipVisible
          getTooltipPopupContainer={(triggerNode: HTMLElement): HTMLElement => {
            triggerNode.style.pointerEvents = 'none'
            this.setState({ tooltip: triggerNode })
            return triggerNode
          }}
          {...this.props}
        />
      </Wrapper>
    )
  }
}

const Wrapper = styled.div`
  background: ${({ theme }): string => theme.colors.foreground};
  border-color: ${({ theme }): string => theme.colors.accent};
  border-radius: 1rem;
  border-style: solid;
  border-width: 1px;
  height: 3.875rem;
  margin: 0;
  padding: 0 0.3rem;
  position: relative;
`

const StyledAntdSlider = styled(Slider)<{
  touchingSlider: boolean
  touchDevice: boolean
}>`
  & {
    height: 100%;
    margin: 0;
    padding: 0;
    border-radius: 1rem;
    // Tooltip color
    .ant-tooltip-inner,
    .ant-tooltip-arrow-content {
      background-color: ${({ theme }): string => theme.colors.primary};
    }
    /* Hide the handle and track by default */
    .ant-slider-rail,
    .ant-slider-track,
    .ant-slider-handle,
    .ant-slider-step {
      transition: opacity 0.3s, box-shadow 0.3s;
      transition-timing-function: ease;
      opacity: 0;
      height: 100%;
      border-radius: 1rem;
    }
    .ant-slider-handle {
      height: 100%;
      margin: 0;
      background-color: ${({ theme }): string => theme.colors.primary};
      border: solid 2px ${({ theme }): string => theme.colors.primary};
      border-radius: 0.25rem;
      width: 1rem;
      z-index: 2;
      // Override default antd shadow
      box-shadow: 0 0 0 0px rgba(24, 144, 255, 0.12);
      :focus {
        box-shadow: 0 0 0 0px rgba(24, 144, 255, 0.12);
      }
    }
    .ant-slider-track {
      background-color: ${({ theme }): string => theme.colors.primaryLight};
      margin-left: -0.3rem;
      border-bottom-right-radius: 0;
      border-top-right-radius: 0;
    }
    :hover {
      .ant-slider-track {
        background-color: ${({ theme }): string => theme.colors.primaryLight};
      }
      .ant-slider-handle {
        background-color: ${({ theme }): string => theme.colors.primary};
        border-color: ${({ theme }): string => theme.colors.primary};
      }
      .ant-slider-handle:not(.ant-tooltip-open) {
        border-color: ${({ theme }): string => theme.colors.primary};
      }
    }

    ${({ touchingSlider, touchDevice }): string => {
      // Desktop hover and drag
      if (!touchDevice) {
        return `
          :active {
            .ant-slider-handle {
              box-shadow: 0 0 0 5px rgba(24, 144, 255, 0.12);
            }
          }
          :hover {
            .ant-slider-handle,
            .ant-slider-step {
              opacity: 1 !important;
            }
            .ant-slider-track {
              opacity: 0.5;
            }
          }
        `
      }

      // Mobile touch
      return `
        .ant-slider-handle,
        .ant-slider-step {
          opacity: ${touchingSlider ? '1' : '0'} !important;
        }
        .ant-slider-track {
          opacity: ${touchingSlider ? '0.5' : '0'};
        }
        .ant-slider-handle {
          box-shadow: 0 0 0 ${touchingSlider ? '5' : '0'}px rgba(24, 144, 255, 0.12);
        }
      `
    }}
  }
`
