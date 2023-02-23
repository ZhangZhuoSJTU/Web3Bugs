/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'

import Icon, { Props, iconsList } from './Icon'
import { IconName } from './icon.types'

const options = Object.keys(iconsList)

export default {
  title: 'Components/Icon',
  component: Icon,
  argTypes: {
    name: {
      control: {
        type: 'select',
        options,
      },
    },
    color: {
      control: {
        type: 'select',
        options: ['primary', 'secondary', 'iconGray', 'black'],
      },
    },
    height: {
      control: {
        type: 'number',
        options: 50,
      },
    },
    width: {
      control: {
        type: 'number',
        options: 50,
      },
    },
  },
  args: {
    name: 'logo',
    color: 'primary',
    height: 50,
    width: 50,
  },
} as Meta

const Template: Story<Props> = ({ ...args }) => <Icon {...(args as Props)} />

export const Default = Template.bind({})

const ListTemplate: Story<Props> = ({ ...args }) => (
  <div>
    {options.map((name) => (
      <div key={name} style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ minWidth: 200 }}>{name}</div>
        <Icon {...(args as Props)} name={name as IconName} />
      </div>
    ))}
  </div>
)

export const IconList = ListTemplate.bind({})
