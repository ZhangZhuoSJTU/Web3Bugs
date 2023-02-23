import { makeAutoObservable } from 'mobx'
import { RootStore } from './RootStore'

export class UiStore {
  root: RootStore
  isMobileMenuOpen: boolean

  constructor(root: RootStore) {
    this.root = root
    this.isMobileMenuOpen = false
    makeAutoObservable(this, {}, { autoBind: true })
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen
  }
}
