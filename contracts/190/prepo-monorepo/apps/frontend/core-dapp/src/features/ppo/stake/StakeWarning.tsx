import { Alert, media, spacingIncrement } from 'prepo-ui'

import styled, { Color } from 'styled-components'

export type MessageType = {
  type: keyof Pick<Color, 'error' | 'warning' | 'success'>
  message: string | React.ReactElement
  key: string
}

type Props = { messages: MessageType[] }

const StyledList = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral6};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  margin: 0;
  padding: 0;
  ${media.desktop`
    padding: ${spacingIncrement(4)};
  `}
  .ant-alert {
    align-items: flex-start;
  }
`

const StakeWarning: React.FC<Props> = ({ messages }) => (
  <StyledList>
    {messages.map(({ message, type, key }) => (
      <Alert
        message={message}
        type={type}
        key={key}
        background="neutral10"
        showIcon
        color="neutral4"
      />
    ))}
  </StyledList>
)

export default StakeWarning
