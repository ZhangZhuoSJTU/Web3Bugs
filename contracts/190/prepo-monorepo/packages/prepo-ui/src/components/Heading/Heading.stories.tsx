/* eslint-disable import/no-extraneous-dependencies */
import { Story, Meta } from '@storybook/react'
import Heading, { HeaderProps } from './Heading'

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Components/Heading',
  component: Heading,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    type: {
      control: {
        type: 'select',
        options: ['h1', 'h2', 'h3', 'h4', 'h5'],
      },
    },
    align: {
      control: {
        type: 'select',
        options: ['left', 'center', 'right'],
      },
    },
    color: {
      control: {
        type: 'select',
        options: ['primary', 'secondary', 'black'],
      },
    },
  },
  args: {
    type: 'h2',
    align: 'left',
    color: 'primary',
    children: 'Heading',
  },
} as Meta

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: Story<HeaderProps> = (args) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Heading {...args} />
)

export const H1 = Template.bind({})
H1.args = {
  type: 'h1',
}

export const H2 = Template.bind({})
H2.args = {
  type: 'h2',
}

export const H3 = Template.bind({})
H3.args = {
  type: 'h3',
}

export const H4 = Template.bind({})
H4.args = {
  type: 'h4',
}

export const H5 = Template.bind({})
H5.args = {
  type: 'h5',
}

export const Left = Template.bind({})
Left.args = {
  type: 'h1',
  align: 'left',
}

export const Center = Template.bind({})
Center.args = {
  type: 'h1',
  align: 'center',
}

export const Right = Template.bind({})
Right.args = {
  type: 'h1',
  align: 'right',
}
