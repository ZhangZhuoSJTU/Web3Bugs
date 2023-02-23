/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import TokenInput from './TokenInput'

export default {
  title: 'Components/TokenInput',
  component: TokenInput,
} as Meta

// eslint-disable-next-line react/jsx-props-no-spreading
const Template: Story = (args) => <TokenInput {...args} />

export const Basic = Template.bind({})
Basic.args = { balance: 10000, connected: true, usd: true }

export const WithShadowPrefix = Template.bind({})
WithShadowPrefix.args = { balance: 10000, connected: true, usd: true, value: 100 }

export const WithSlider = Template.bind({})
WithSlider.args = {
  balance: 10000,
  connected: true,
  usd: true,
  value: 100,
  showSlider: true,
  max: 10000,
}

export const PPO = Template.bind({})
PPO.args = {
  alignInput: 'right',
  balance: 10000,
  connected: true,
  showSlider: true,
  symbol: 'PPO',
  iconName: 'ppo-logo',
}

export const WalletNotConnected = Template.bind({})
WalletNotConnected.args = {
  alignInput: 'right',
  balance: 10000,
  showSlider: true,
  symbol: 'PPO',
  iconName: 'ppo-logo',
}
