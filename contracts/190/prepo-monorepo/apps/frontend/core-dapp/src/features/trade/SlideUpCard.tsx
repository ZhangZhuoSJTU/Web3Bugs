import styled from 'styled-components'
import { Button, Flex, Icon, spacingIncrement, Typography } from 'prepo-ui'

type Props = {
  title?: React.ReactNode
  onClose?: () => void
  show?: boolean
}

const Wrapper = styled.div<{ show?: boolean }>`
  background-color: ${({ theme }): string => theme.color.neutral10};
  border-radius: ${({ theme }): string => theme.borderRadius.lg};
  inset: 0;
  overflow: hidden;
  position: absolute;
  top: ${({ show }): string => (show ? '0' : '100%')};
  transition: top 0.2s ease-out;
  width: 100%;
  z-index: 5;
`

const RelativeWrapper = styled.div`
  height: 100%;
  position: relative;
  width: 100%;
`

const InnerWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  padding: ${spacingIncrement(16)} ${spacingIncrement(24)};
  padding-bottom: 0;
`

const OverflowGradient = styled.div`
  background: linear-gradient(
    0deg,
    ${({ theme }): string => theme.color.neutral10} 0%,
    rgba(255, 255, 255, 0) 100%
  );
  bottom: 0;
  height: ${spacingIncrement(80)};
  left: 0;
  pointer-events: none;
  position: absolute;
  width: 380px;
`

const OverflowWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding-bottom: ${spacingIncrement(60)};
`

const CloseButton = styled(Button)`
  &&&& {
    button {
      color: ${({ theme }): string => theme.color.neutral5};
    }
  }
`

const SlideUpCard: React.FC<Props> = ({ children, onClose, show, title }) => {
  const handleClose = (): void => {
    if (onClose) onClose()
  }
  return (
    <Wrapper show={show}>
      <RelativeWrapper>
        <InnerWrapper>
          <Flex justifyContent="space-between" mb={12}>
            {typeof title === 'string' || title === undefined ? (
              <Typography variant="text-semiBold-base" color="secondary">
                {title}
              </Typography>
            ) : (
              title
            )}{' '}
            <CloseButton
              onClick={handleClose}
              icon={<Icon name="cross" height="16" width="16" />}
              size="xs"
              type="text"
            />
          </Flex>
          <OverflowWrapper>{children}</OverflowWrapper>
        </InnerWrapper>
        <OverflowGradient />
      </RelativeWrapper>
    </Wrapper>
  )
}

export default SlideUpCard
