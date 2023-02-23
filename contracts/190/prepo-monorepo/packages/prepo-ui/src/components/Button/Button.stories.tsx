/* eslint-disable import/no-extraneous-dependencies */
import React from 'react'
import { Story, Meta } from '@storybook/react'
import Button, { ButtonProps } from './Button'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Button',
  component: Button,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    type: {
      control: {
        type: 'select',
        options: ['default', 'primary', 'text', 'ghost'],
      },
    },
    disabled: {
      control: {
        type: 'radio',
        options: [true, false],
      },
    },
    size: {
      name: 'Size',
      description: 'The size of the button',
      defaultValue: 'base',
      table: {
        type: { summary: 'Size' },
        defaultValue: { summary: 'base' },
      },
      control: {
        type: 'select',
        options: ['base', 'sm', 'xs'],
      },
    },
    onClick: { action: 'onClick' },
  },
  args: {
    children: 'Button',
  },
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<ButtonProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Button {...args} />
)

export const Default = Template.bind({})

export const DefaultDisabled = Template.bind({})
DefaultDisabled.args = {
  disabled: true,
}

export const Primary = Template.bind({})
Primary.args = {
  type: 'primary',
  disabled: false,
}

export const PrimaryDisabled = Template.bind({})
PrimaryDisabled.args = {
  type: 'primary',
  disabled: true,
}

export const Text = Template.bind({})
Text.args = {
  type: 'text',
  disabled: false,
}

export const TextDisabled = Template.bind({})
TextDisabled.args = {
  type: 'text',
  disabled: true,
}
