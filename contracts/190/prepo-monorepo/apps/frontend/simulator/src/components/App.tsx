import React from 'react'
import { ThemeProvider } from 'styled-components'
import GlobalStyle from './GlobalStyle'
import { ModalContextProvider } from './Modal/ModalContext'
import Simulation from './Simulation'
import WelcomeModal from '../features/welcome-modal/WelcomeModal'
import { useAppSelector } from '../app/hooks'
import RestoreLabState from '../features/welcome-modal/RestoreLabState'

const App: React.FC = () => {
  const theme = useAppSelector((state) => state.app.theme)
  return (
    <ThemeProvider theme={theme}>
      <ModalContextProvider
        showModal
        body={<WelcomeModal />}
        closeOnClickOverlay={false}
        topRight={<RestoreLabState />}
      >
        <GlobalStyle />
        <Simulation />
      </ModalContextProvider>
    </ThemeProvider>
  )
}

export default App
