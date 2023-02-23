import { Card as ACard, CardProps } from 'antd'
import styled from 'styled-components'
import { centered, spacingIncrement } from 'prepo-ui'

const Wrapper = styled.div`
  &&& {
    ${centered}
    border-radius: ${({ theme }): string => theme.borderRadius.lg};
    .ant-card {
      background-color: ${({ theme }): string => theme.color.neutral10};
      box-shadow: 0px 4px 22px rgba(98, 100, 216, 0.11);
      border-radius: inherit;
      border: unset;
    }
    .ant-card-body {
      border-radius: inherit;
      padding: ${spacingIncrement(35)} ${spacingIncrement(30)};
    }
  }
`

const Card: React.FC<CardProps> = ({ ...props }) => {
  const component = (
    <Wrapper>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <ACard {...props} />
    </Wrapper>
  )

  return component
}

export default Card
