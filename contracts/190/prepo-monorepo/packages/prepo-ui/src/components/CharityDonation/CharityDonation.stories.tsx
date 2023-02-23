/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import CharityDonation, { Props } from './CharityDonation'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/CharityDonation',
  component: CharityDonation,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
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
    balance: {
      name: 'Balance',
      defaultValue: '0.0003342 WETH',
      type: { name: 'string', required: false },
      description: 'The user balance of the token that will be used for charity.',
      table: {
        type: { summary: 'string' },
      },
      control: {
        type: 'text',
      },
    },
    title: {
      name: 'Title',
      defaultValue: 'Charity Donation',
      type: { name: 'string', required: true },
      description: 'The title of the charity donation component.',
      table: {
        type: { summary: 'string' },
      },
      control: {
        type: 'text',
      },
    },
    footerText: {
      name: 'Footer text',
      defaultValue: 'You are donating above average, 96% more than the usual donation.',
      type: { name: 'string', required: false },
      description: 'The text that will be rendered on the footer of the component',
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
const Template: Story<Props> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <CharityDonation {...args} />
)

export const Default = Template.bind({})
Default.args = {}
