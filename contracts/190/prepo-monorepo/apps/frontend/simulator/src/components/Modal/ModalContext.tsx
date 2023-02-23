/* eslint-disable react/no-unused-prop-types */
import React, { createContext, useContext, useState, useMemo } from 'react'
import Modal from './Modal'
import { useAppSelector } from '../../app/hooks'

export type ModalContextProviderValues = {
  showModal?: boolean
  title?: string
  body?: React.ReactNode
  topRight?: React.ReactNode
  footer?: React.ReactNode
  closeOnClickOverlay?: boolean
  showTopRight?: boolean
}

export type ModalContextProviderMethods = {
  setShowModal: (value: boolean) => void
  renderModal: ({
    title,
    body,
    footer,
    topRight,
  }: {
    title: string
    body: React.ReactNode
    footer?: React.ReactNode
    topRight?: React.ReactNode
  }) => void
}

export type ModalContextProviderState = ModalContextProviderValues & ModalContextProviderMethods

const ModalContext = createContext({} as ModalContextProviderState)

export const ModalContextProvider: React.FC<ModalContextProviderValues> = ({
  children,
  showModal: showModalInitialValue,
  body: bodyInitialValue,
  closeOnClickOverlay: closeOnClickOverlayInitialValue,
  topRight: topRightInitialValue,
}) => {
  const [showModal, setShowModal] = useState<boolean>(showModalInitialValue ?? false)
  const [closeOnClickOverlay, setCloseOnClickOverlay] = useState<boolean>(
    closeOnClickOverlayInitialValue ?? true
  )
  const [localTitle, setTitle] = useState<string>('')
  const [localBody, setBody] = useState<React.ReactNode>(bodyInitialValue)
  const [localTopRight, setLocalTopRight] = useState<React.ReactNode>(topRightInitialValue)
  const [localFooter, setFooter] = useState<React.ReactNode>()
  const showTopRight = useAppSelector((state) => state.app.startOver)

  const value = useMemo(() => {
    const renderModal = ({
      title,
      body,
      footer,
      topRight,
      closeOnClickOverlay: closeOnClickOverlayRender = true,
    }: {
      title: string
      body: React.ReactNode
      footer?: React.ReactNode
      topRight?: React.ReactNode
      closeOnClickOverlay?: boolean
    }): void => {
      setShowModal(!showModal)
      setCloseOnClickOverlay(closeOnClickOverlayRender)
      setTitle(title)
      setBody(body)
      setFooter(footer)
      setLocalTopRight(topRight)
    }

    const values = {
      showModal,
      setShowModal,
      closeOnClickOverlay,
      title: localTitle,
      body: localBody,
      footer: localFooter,
      topRight: localTopRight,
      renderModal,
      showTopRight,
    }
    return values
  }, [
    closeOnClickOverlay,
    localBody,
    localFooter,
    localTitle,
    localTopRight,
    showModal,
    showTopRight,
  ])

  return (
    <ModalContext.Provider value={value}>
      <Modal />
      {children}
    </ModalContext.Provider>
  )
}

export const useModalContext = (): ModalContextProviderState => useContext(ModalContext)

export default ModalContext
