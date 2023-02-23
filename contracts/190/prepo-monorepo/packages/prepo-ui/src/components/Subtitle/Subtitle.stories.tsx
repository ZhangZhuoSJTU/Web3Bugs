/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import Subtitle, { SubtitleProps } from './Subtitle'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Subtitle',
  component: Subtitle,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    children: {
      name: 'Children',
      type: { name: 'string', required: true },
      description: 'The text to be rendered as subtitle',
      defaultValue: 'Subtitle',
      table: {
        type: { summary: 'string' },
      },
      control: {
        type: 'text',
      },
    },
    tooltip: {
      name: 'Tooltip',
      type: { name: 'string', required: false },
      description: 'The tooltip text to be shown when hovering over the icon',
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
const Template: Story<SubtitleProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Subtitle {...args} />
)

export const Default = Template.bind({})
Default.args = {}

export const WithTooltip = Template.bind({})
WithTooltip.args = {
  tooltip: 'This is a tooltip',
}
