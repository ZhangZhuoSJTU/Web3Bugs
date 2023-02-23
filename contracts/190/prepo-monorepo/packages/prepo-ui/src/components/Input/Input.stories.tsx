/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import styled from 'styled-components'
import Input from './Input'
import Icon from '../Icon'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
`

const Currency = styled.span`
  color: black;
  font-weight: 700;
`

const MockedUsdc: React.FC = () => (
  <Wrapper>
    <Icon name="usdc" />
    <Currency>USDC</Currency>
  </Wrapper>
)

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Input',
  component: Input,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    disabled: {
      type: 'boolean',
    },
    placeholder: {
      type: 'string',
    },
    renderLeft: {
      description: 'Render content at the right of input, within the box.',
      type: 'string',
    },
    renderRight: {
      description: 'Render content at the right of input, within the box.',
      type: 'string',
    },
    size: {
      control: {
        type: 'select',
        options: ['small', 'middle', 'large'],
      },
    },
    type: {
      control: {
        type: 'select',
        options: ['email', 'number', 'password', 'text'],
      },
    },
  },
  args: {},
} as Meta

// eslint-disable-next-line react/jsx-props-no-spreading
const Template: Story = (args) => <Input {...args} />

export const InputOnly = Template.bind({})
InputOnly.args = {}

export const DisabledWithPrefix = Template.bind({})
DisabledWithPrefix.args = {
  label: 'Token to Receive',
  prefix: <MockedUsdc />,
  disabled: true,
  secondaryLabel: 'Balance: 10,000 USDC',
}

export const WithLabelAndSecondaryLabel = Template.bind({})
WithLabelAndSecondaryLabel.args = {
  alignInput: 'right',
  label: 'Amount',
  placeholder: '0',
  prefix: <MockedUsdc />,
  secondaryLabel: 'Balance: 10,000 USDC',
}

export const WithClearLabel = Template.bind({})
WithClearLabel.args = {
  label: 'ENS Name or Address',
  placeholder: 'vitalik.eth',
  onClear: (): void => {
    // eslint-disable-next-line no-console
    console.log('Clear vitalik.eth')
  },
}
