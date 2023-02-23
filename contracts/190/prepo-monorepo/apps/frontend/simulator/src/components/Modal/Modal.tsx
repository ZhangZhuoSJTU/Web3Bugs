import React from 'react'
import { createPortal } from 'react-dom'
import Div100vh from 'react-div-100vh'
import styled from 'styled-components'
import { useModalContext } from './ModalContext'
import { media } from '../../utils/media'
import { spacingIncrement } from '../../features/app/themes'

export const ModalBlock = styled(Div100vh)`
  align-items: center;
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  opacity: 1;
  overflow: hidden;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 400;

  ${media.lg`
    display: flex;
    flex-direction: column;
  `}
`

export const ModalOverlay = styled.a`
  background: ${({ theme }): string => theme.colors.background};
  bottom: 0;
  cursor: default;
  display: block;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
`

const ModalTopRight = styled.div`
  margin: ${spacingIncrement(4)};
  max-height: 12%;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1;

  ${media.lg`
    margin: 0 ${spacingIncrement(2.8)};
    margin-bottom: ${spacingIncrement(1)};
    position: relative;
  `}
`

export const ModalClose = styled.a`
  color: ${({ theme }): string => theme.colors.primary};
  cursor: pointer;
  float: right;
  font-size: 1rem;
  text-decoration: none;
`

export const ModalContainer = styled.div`
  animation: slide-down 0.2s ease 1;
  background: ${({ theme }): string => theme.colors.foreground};
  border-radius: 0.75rem;
  box-shadow: 0 0.2rem 0.5rem rgba(48, 55, 66, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 88%;
  max-width: 44%;
  padding: ${spacingIncrement(4)};
  width: 100%;
  z-index: 1;

  ${media.lg`
    max-width: 90%;
    padding: ${spacingIncrement(4)};
  `}
`

export const ModalBody = styled.div`
  overflow-y: auto;
  position: relative;
`

export const ModalHeader = styled.div`
  color: ${({ theme }): string => theme.colors.textPrimary};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: ${spacingIncrement(4)};
  padding-left: ${spacingIncrement(2)};
  padding-right: ${spacingIncrement(2)};
  padding-top: ${spacingIncrement(4)};
`

export const ModalTitle = styled.span`
  font-size: 1.5rem;
`

export const ModalFooter = styled.div`
  text-align: right;
`

export const Button = styled.button`
  background: #7b2cbf;
  border: 2px solid #7b2cbf;
  border-radius: 3px;
  color: white;
  cursor: pointer;
  font-size: 1em;
  margin: 10px;
  padding: 5px 10px;
`

const Modal: React.FC = () => {
  const {
    showTopRight,
    topRight,
    closeOnClickOverlay,
    title,
    body,
    footer,
    setShowModal,
    showModal,
  } = useModalContext()

  let portalContainer
  if (typeof window !== undefined) {
    portalContainer = document && document.querySelector('#modal-root')
  }

  if (!portalContainer) {
    return null
  }

  if (showModal) {
    return createPortal(
      <ModalBlock>
        <ModalOverlay
          onClick={(): void => {
            if (closeOnClickOverlay) {
              setShowModal(!showModal)
            }
          }}
        />
        {showTopRight && <ModalTopRight>{topRight}</ModalTopRight>}
        <ModalContainer>
          {title && (
            <ModalHeader>
              <ModalTitle>{title}</ModalTitle>
              <ModalClose onClick={(): void => setShowModal(!showModal)}>X</ModalClose>
            </ModalHeader>
          )}
          <ModalBody>{body}</ModalBody>
          {footer && <ModalFooter>{footer}</ModalFooter>}
        </ModalContainer>
      </ModalBlock>,
      portalContainer
    )
  }
  return null
}
export default Modal
