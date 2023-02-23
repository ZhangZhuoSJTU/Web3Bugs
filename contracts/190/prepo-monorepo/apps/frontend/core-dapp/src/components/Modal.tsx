import { Modal as AModal, ModalProps } from 'antd'
import styled, { css, DefaultTheme, FlattenInterpolation, ThemeProps } from 'styled-components'
import { centered, Icon, media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useLayoutEffect, useRef } from 'react'
import { useRootStore } from '../context/RootStoreProvider'

type Props = {
  bottom?: boolean
  titleAlign?: 'center' | 'left'
  height?: number
  disabledClose?: boolean
} & ModalProps

const modalPositionBottomCss = css<Props>`
  bottom: 0;
  height: ${({ height }): string => (height ? `${height}px` : `70vh`)};
  left: 0;
  overflow-y: auto;
  position: fixed;
  right: 0;
`

const bottomModalBorderCss = css`
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: ${({ theme }): string => theme.borderRadius.xs};
  border-top-right-radius: ${({ theme }): string => theme.borderRadius.xs};
`

export const modalStylesCss = css<Props>`
  &&& {
    ${({ bottom }): FlattenInterpolation<ThemeProps<DefaultTheme>> | null =>
      bottom ? modalPositionBottomCss : null}
    .ant-modal-content {
      background-color: ${({ theme }): string => theme.color.neutral9};
      padding: 0 ${spacingIncrement(10)};
      ${({ bottom }): FlattenInterpolation<ThemeProps<DefaultTheme>> | null =>
        bottom ? modalPositionBottomCss : null}
      ${({ bottom }): FlattenInterpolation<ThemeProps<DefaultTheme>> | null =>
        bottom ? bottomModalBorderCss : null}
    }
    .ant-modal-header {
      background-color: inherit;
      border-bottom: 0px;
      padding-top: ${spacingIncrement(32)};
    }
    .ant-modal-body {
      padding-top: ${spacingIncrement(5)};
    }
    .ant-modal-close {
      ${({ disabledClose }): string => (disabledClose ? 'cursor: not-allowed;' : '')}
      height: min-content;
      top: ${spacingIncrement(32)};
      right: ${spacingIncrement(34)};
      color: ${({ theme }): string => theme.color.secondary};
      width: min-content;
    }
    .ant-modal-close-x {
      height: min-content;
      width: min-content;
    }
    .ant-modal-title {
      color: ${({ theme }): string => theme.color.secondary};
      font-size: ${({ theme }): string => theme.fontSize.base};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      text-align: ${({ titleAlign }): string | undefined => titleAlign};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.md};
      `}
    }
  }
`

const CloseIconWrapper = styled.div`
  ${centered}
  height: 100%;
`

const StyledModal = styled(AModal)`
  ${modalStylesCss};
`

const Content: React.FC = ({ children }) => {
  const { uiStore } = useRootStore()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (ref && ref.current) {
      const height = ref.current.offsetHeight
      uiStore.setModalHeight(height)
    }
  }, [ref, uiStore])

  return <div ref={ref}>{children}</div>
}

const Modal: React.FC<Props> = ({
  bottom,
  titleAlign = 'center',
  children,
  disabledClose,
  ...props
}) => {
  const { uiStore } = useRootStore()
  return (
    <StyledModal
      closeIcon={
        <CloseIconWrapper>
          <Icon name="cross" color="secondary" height="24" width="24" />
        </CloseIconWrapper>
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      /* @ts-ignore */
      disabledClose={disabledClose}
      height={uiStore.modalHeight}
      transitionName=""
      bottom={bottom}
      destroyOnClose
      titleAlign={titleAlign}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      <Content>{children}</Content>
    </StyledModal>
  )
}

export default observer(Modal)
