import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { SkeletonTheme } from 'react-loading-skeleton'
import { CustomThemeProvider, PresetTheme, ThemeModes } from 'prepo-ui'
import GlobalStyle, { AntdGlobalStyle } from './GlobalStyle'
import { useRootStore } from '../context/RootStoreProvider'

const AppBootstrap: React.FC = ({ children }) => {
  const { localStorageStore, web3Store, uiStore } = useRootStore()

  useEffect(() => {
    localStorageStore.load()
  }, [localStorageStore])

  useEffect(() => {
    if (localStorageStore) {
      web3Store.init()
    }
  }, [web3Store, localStorageStore])

  useEffect(() => {
    uiStore.setMaxScreenHeight(window.innerHeight)
  }, [uiStore])

  useEffect(() => {
    if (uiStore.selectedTheme === undefined) {
      const theme = window.matchMedia('(prefers-color-scheme: light)').matches
        ? ThemeModes.Light
        : ThemeModes.Dark
      uiStore.setTheme(theme)
    }
  }, [uiStore.selectedTheme, uiStore])

  return (
    <SkeletonTheme>
      <CustomThemeProvider theme={PresetTheme.CoreDapp} mode={uiStore.selectedTheme}>
        <GlobalStyle />
        <AntdGlobalStyle />
        {children}
      </CustomThemeProvider>
    </SkeletonTheme>
  )
}

export default observer(AppBootstrap)
