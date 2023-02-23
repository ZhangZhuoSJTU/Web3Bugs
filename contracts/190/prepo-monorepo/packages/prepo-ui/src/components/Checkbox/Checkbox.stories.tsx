/* eslint-disable import/no-extraneous-dependencies */
import React from 'react'
import { Story, Meta } from '@storybook/react'

import { CheckboxProps } from 'antd'
import Checkbox from './Checkbox'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    disabled: {
      control: {
        type: 'radio',
        options: [true, false],
      },
    },
    onChange: { action: 'onChange' },
  },
  args: {
    children: 'Checkbox',
  },
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<CheckboxProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Checkbox {...args} />
)

export const Default = Template.bind({})

export const DefaultDisabled = Template.bind({})
DefaultDisabled.args = {
  disabled: true,
}

export const Checked = Template.bind({})
Checked.args = {
  defaultChecked: true,
  disabled: false,
}

export const CheckedDisabled = Template.bind({})
CheckedDisabled.args = {
  defaultChecked: true,
  disabled: true,
}
