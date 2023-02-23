import React from 'react'
import styled from 'styled-components'
import { Modal, ModalProps } from 'antd'
import ModalCloseIcon from '../assets/images/modal-close-icon.svg'

const StyledAntdModal = styled(Modal)`
  &&& {
    .ant-modal-content {
      border-color: ${({ theme }): string => theme.colors.accent};
      border-radius: 0.5rem;
    }

    .ant-modal-header {
      border-bottom: 0;
      border-radius: 0.5rem;
      padding-top: 1.25rem;
    }

    .ant-modal-title {
      font-weight: bold;
      font-size: 1.0625rem;
      color: ${({ theme }): string => theme.colors.primary};
    }

    .ant-modal-body {
      padding-top: 0;
    }
  }
`
interface Props extends ModalProps {
  children: React.ReactChild
}

const StyledModal: React.FC<Props> = ({ children, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <StyledAntdModal {...props} closeIcon={<img src={ModalCloseIcon} alt="modal close icon" />}>
    {children}
  </StyledAntdModal>
)

export default StyledModal
