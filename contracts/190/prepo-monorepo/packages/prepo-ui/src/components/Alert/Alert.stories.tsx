/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import { AlertProps } from 'antd'
import Alert from './Alert'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Alert',
  component: Alert,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    type: {
      control: {
        type: 'select',
        options: ['success', 'warning', 'info', 'error'],
      },
    },
    message: {
      control: {
        type: 'text',
      },
    },
    showIcon: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    type: 'success',
    message: 'Alert Message',
  },
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<AlertProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Alert {...args} />
)

export const Success = Template.bind({})
Success.args = {
  type: 'success',
  message: 'Alert Message',
}

export const Warning = Template.bind({})
Warning.args = {
  type: 'warning',
  message: 'Alert Message',
}

export const WarningWithIcon = Template.bind({})
WarningWithIcon.args = {
  type: 'warning',
  showIcon: true,
  message: 'Alert Message',
}

export const WarningWithIconNoBackground = Template.bind({})
WarningWithIconNoBackground.args = {
  type: 'warning',
  showIcon: true,
  background: 'transparent',
  message: 'Alert Message',
}
export const WarningWithIconNoBackgroundCustomColor = Template.bind({})
WarningWithIconNoBackgroundCustomColor.args = {
  type: 'warning',
  showIcon: true,
  background: 'transparent',
  message: 'Alert Message',
  color: 'neutral3',
}

export const DangerWithIconNoBackground = Template.bind({})
DangerWithIconNoBackground.args = {
  type: 'error',
  showIcon: true,
  background: 'transparent',
  message: 'Alert Message',
}
