import { makeAutoObservable } from 'mobx'
import { SEC_IN_MS } from 'prepo-constants'
import { RootStore } from './RootStore'

export class ClockStore {
  root: RootStore<unknown>
  now: Date

  constructor(root: RootStore<unknown>) {
    this.root = root
    this.now = new Date()
    makeAutoObservable(this)

    if (process.env.NODE_ENV !== 'test') {
      // No setInterval in test environment, so jest can exit cleanly
      setInterval(this.updateNow.bind(this), SEC_IN_MS)
    }
  }

  updateNow(): void {
    this.now = new Date()
  }
}
