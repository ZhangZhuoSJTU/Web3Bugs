/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import Typography, { TEXT_TYPE_ARRAY } from './Typography'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Base/Typography',
  component: Typography,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<any> = (args) => (
  <>
    {TEXT_TYPE_ARRAY.map((type) => (
      <Typography {...args} variant={type} key={type}>
        {type.split('-').join(' ')}
      </Typography>
    ))}
  </>
)

export const Example = Template.bind({})
Example.args = {
  my: 2,
}

const Custom: Story<any> = (args) => (
  <Typography {...args} variant="text-extraBold-base">
    Custom Typography
  </Typography>
)

export const CustomTypography = Custom.bind({})
CustomTypography.args = {
  my: 2,
  fontSize: { dekstop: 30, phone: 40 },
  lineHeight: '40px',
}
