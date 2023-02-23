/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import { GridProps } from 'styled-system'

import Grid from './Grid'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Base/Grid',
  component: Grid,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {},
  args: {},
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<GridProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Grid {...(args as unknown)}>
    <div>grid</div>
    <div>example</div>
    <div>grid</div>
    <div>example</div>
  </Grid>
)

export const Example = Template.bind({})
Example.args = {
  background: 'neutral3',
  color: 'error',
  width: 180,
  gap: '20px 40px',
  gridTemplateColumns: '1fr 1fr',
  gridAutoRows: '50px',
}
