/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import { FlexProps } from 'styled-system'

import Flex from './Flex'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Base/Flex',
  component: Flex,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<FlexProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Flex {...(args as unknown)}>
    <div>flex</div>
    <div>example</div>
  </Flex>
)

export const BasicUsage = Template.bind({})
BasicUsage.args = {
  background: { phone: 'primary', tablet: 'warning', desktop: 'error', largeDesktop: 'primary' },
  color: 'error',
  height: 180,
  width: 180,
  p: { phone: 12, desktop: 40 },
  mt: { phone: 12, desktop: 40 },
  ml: { phone: 12, desktop: 40, tablet: 20, largeDesktop: 50 },
  borderColor: 'warning',
  borderWidth: 1,
  borderStyle: 'solid',
  gap: 20,
  flexDirection: ['column', 'column', 'row'],
  justifyContent: 'flex-start',
}
