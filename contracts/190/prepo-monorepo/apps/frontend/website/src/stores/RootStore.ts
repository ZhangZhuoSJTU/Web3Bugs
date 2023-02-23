import { UiStore } from './UiStore'

export class RootStore {
  uiStore: UiStore

  constructor() {
    this.uiStore = new UiStore(this)
  }
}
