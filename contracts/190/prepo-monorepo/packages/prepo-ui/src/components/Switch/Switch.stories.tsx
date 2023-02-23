/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import { SwitchProps } from 'antd'

import Switch from './Switch'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Switch',
  component: Switch,
  argTypes: {
    color: {
      control: {
        type: 'select',
        options: ['primary', 'secondary', 'iconGray', 'black'],
      },
    },
  },
  args: {
    color: 'primary',
  },
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<SwitchProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Switch {...args} />
)

export const Default = Template.bind({})
Default.args = {}
