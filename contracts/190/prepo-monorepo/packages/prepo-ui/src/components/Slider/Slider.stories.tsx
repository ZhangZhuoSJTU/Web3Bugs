/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import { AlertProps } from 'antd'
import Slider from './Slider'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Slider',
  component: Slider,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    value: {
      name: 'Value',
      description:
        'The value of the Slider. You can use this if you want to dynamically control the slider.',
      defaultValue: 0,
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: 0 },
      },
      control: {
        type: 'number',
      },
    },
    trackColor: {
      name: 'Track color',
      description: 'The color of the slider',
      defaultValue: 'success',
      table: {
        type: { summary: 'keyOf Color' },
        defaultValue: { summary: 'success' },
      },
      control: {
        type: 'select',
        options: ['success', 'error', 'warning'],
      },
    },
    focusColor: {
      name: 'Focus color',
      description: 'Focus color of the slider',
      defaultValue: 'success',
      table: {
        type: { summary: 'keyOf Color' },
        defaultValue: { summary: 'success' },
      },
      control: {
        type: 'select',
        options: ['success', 'error', 'warning'],
      },
    },
    labelPosition: {
      name: 'Label Position',
      description: 'The position of the labels for the slider',
      defaultValue: 'top',
      table: {
        type: { summary: 'LabelPosition' },
        defaultValue: { summary: 'top' },
      },
      control: {
        type: 'select',
        options: ['top', 'side', 'none'],
      },
    },
    labelSpacing: {
      name: 'Label Spacing',
      description: 'The amount of space you want from the labels to the slider',
      defaultValue: 'normal',
      table: {
        type: { summary: 'LabelSpacing' },
        defaultValue: { summary: 'none' },
      },
      control: {
        type: 'select',
        options: ['dense', 'normal', 'none'],
      },
    },
    thumbStyles: {
      name: 'Thumb styles',
      description: 'The type of thumb that you want to use',
      defaultValue: ['pill'],
      table: {
        type: { summary: 'ThumbStyle' },
        defaultValue: { summary: 'none' },
      },
      control: {
        type: 'select',
        options: [['line'], ['pill'], ['circle']],
      },
    },
    thickness: {
      name: 'Slider thickness',
      description: 'How thick will the slider be',
      defaultValue: 'normal',
      table: {
        type: { summary: 'Thickness' },
        defaultValue: { summary: 'none' },
      },
      control: {
        type: 'select',
        options: ['small', 'normal'],
      },
    },
    step: {
      name: 'Step',
      type: { name: 'number', required: false },
      defaultValue: 0.1,
      description: 'How many steps is the slider moving',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
      control: {
        type: 'number',
      },
    },
    min: {
      name: 'Min',
      type: { name: 'number', required: true },
      defaultValue: 1,
      description: 'The minimum value of the slider',
      table: {
        type: { summary: 'number' },
      },
      control: {
        type: 'number',
      },
    },
    max: {
      name: 'Max',
      type: { name: 'number', required: true },
      defaultValue: 10,
      description: 'The max amount of value of the slider',
      table: {
        type: { summary: 'number' },
      },
      control: {
        type: 'number',
      },
    },
    handlesCanPassThrough: {
      name: 'Handles can pass through',
      type: { name: 'boolean', required: false },
      defaultValue: false,
      description: 'Allow the handles to pass through each other',
      table: {
        type: { summary: 'boolean' },
      },
      control: {
        type: 'radio',
        options: [true, false],
      },
    },
    numberFormatter: {
      name: 'Number formatter',
      type: { name: 'function', required: false },
      description: 'Send a function to format the number of the slider',
      table: {
        type: { summary: 'function' },
      },
    },
  },
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<AlertProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Slider max={0} min={0} {...args} />
)

export const SingleSlider = Template.bind({})
SingleSlider.args = {
  value: 0,
  tooltipLabels: ['', ''],
}

export const DoubleSlider = Template.bind({})
DoubleSlider.args = {
  value: [4, 8],
  thumbStyles: ['line', 'pill'],
  tooltipLabels: ['Current', 'Exit'],
}

export const DoubleSliderLeftDisabled = Template.bind({})
DoubleSliderLeftDisabled.args = {
  value: [4, 8],
  thumbStyles: ['line', 'pill'],
  tooltipLabels: ['Current', 'Exit'],
  labelPosition: 'side',
  labelSpacingValue: 40,
  disableSmallThumb: true,
}
export const DoubleSliderRightDisabled = Template.bind({})
DoubleSliderRightDisabled.args = {
  value: [8, 4],
  thumbStyles: ['line', 'pill'],
  tooltipLabels: ['Current', 'Exit'],
  labelPosition: 'side',
  labelSpacingValue: 40,
  disableSmallThumb: true,
}

export const ThinSlider = Template.bind({})
ThinSlider.args = {
  value: 0,
  thumbStyles: ['circle'],
  thickness: 'small',
}

export const ThinSliderPrimaryColor = Template.bind({})
ThinSliderPrimaryColor.args = {
  value: 0,
  thumbStyles: ['circle'],
  thickness: 'small',
  trackColor: 'primary',
  focusColor: 'primary',
}
