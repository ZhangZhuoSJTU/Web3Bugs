/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import Box, { BoxProps } from './Box'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Base/Box',
  component: Box,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<BoxProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Box {...(args as unknown)}>box example</Box>
)

export const Example = Template.bind({})
Example.args = {
  background: 'neutral3',
  color: 'error',
  height: 80,
  p: { phone: 12, desktop: 40 },
  mt: { phone: 12, desktop: 40 },
  ml: { phone: 12, desktop: 40 },
  borderColor: 'warning',
  borderWidth: 1,
  borderStyle: 'solid',
}
