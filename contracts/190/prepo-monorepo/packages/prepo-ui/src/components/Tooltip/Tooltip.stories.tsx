/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import { TooltipProps } from 'antd'
import Tooltip from './Tooltip'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Tooltip',
  component: Tooltip,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    children: {
      name: 'Children',
      type: { name: 'string', required: true },
      description: 'What will be rendered as tooltip content.',
      defaultValue: 'Tooltip',
      table: {
        type: { summary: 'string | React.ReactElement' },
      },
      control: {
        type: 'text',
      },
    },
    title: {
      name: 'Title',
      type: { name: 'string', required: true },
      description: 'The tooltip content that will be shown on hover.',
      defaultValue: 'Some tooltip content',
      table: {
        type: { summary: 'string' },
      },
      control: {
        type: 'text',
      },
    },
  },
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<TooltipProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Tooltip {...args} />
)

export const Default = Template.bind({})
Default.args = {}
