import { makeError } from 'prepo-utils'
import { makeAutoObservable } from 'mobx'
import { Toast } from './utils/stores.types'
import { RootStore } from './RootStore'

export class ToastStore {
  root: RootStore<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: Toast

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(root: RootStore<unknown>, toast: Toast) {
    this.root = root
    this.toast = toast
    makeAutoObservable(this)
  }

  successToast(message: string): void {
    this.toast.success({ message })
  }

  warningToast(message: string): void {
    this.toast.warning({ message })
  }

  errorToast(message: string, err: unknown): void {
    const error = makeError(err, false)
    const description = error.message
    this.toast.error({
      message,
      description,
    })
  }
}
