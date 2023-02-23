import { makeAutoObservable } from 'mobx'
import { DefaultTheme } from 'styled-components'
import { RootStore } from './RootStore'
import { lightTheme } from '../utils/theme/light-theme'
import { SupportedThemes } from '../utils/theme/theme.types'
import { darkTheme } from '../utils/theme/dark-theme'

export class UiStore {
  root: RootStore
  accountModalOpen = false

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this)
  }

  get selectedTheme(): SupportedThemes | undefined {
    return this.root.localStorageStore.storage?.selectedTheme
  }

  setTheme(selectedTheme: SupportedThemes): void {
    this.root.localStorageStore.storage.selectedTheme = selectedTheme
  }

  get themeObject(): DefaultTheme {
    return this.selectedTheme === 'light' ? lightTheme : darkTheme
  }

  setAccountModalOpen(value: boolean): void {
    this.accountModalOpen = value
  }
}
