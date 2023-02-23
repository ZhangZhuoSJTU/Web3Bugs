import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { ThemeProvider } from 'styled-components'
import GlobalStyle from './GlobalStyle'
import { useRootStore } from '../context/RootStoreProvider'

const AppBootstrap: React.FC = ({ children }) => {
  const { localStorageStore, uiStore } = useRootStore()

  useEffect(() => {
    localStorageStore.load()
  }, [localStorageStore])

  return (
    <ThemeProvider theme={uiStore.themeObject}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  )
}

export default observer(AppBootstrap)
