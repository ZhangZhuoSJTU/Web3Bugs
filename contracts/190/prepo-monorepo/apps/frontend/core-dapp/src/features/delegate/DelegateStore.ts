import { makeAutoObservable, reaction, runInAction } from 'mobx'
import React from 'react'
import { RootStore } from '../../stores/RootStore'
import { debounce } from '../../utils/debounce'
import { DelegateEntity } from '../../stores/entities/DelegateEntity'

export const MINIMUM_INPUT_LENGTH = 5
const DEBOUNCE_DELAY_MS = 400
const MAX_TREADS = 8

const DELEGATES_LIST_MOCK = [
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
  '0xf3d5e5c0d6c1e95bd5fe250b11d9cd016d092d94', // firstgeneral.eth - to test reverse lookup
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
  'xavier.eth',
  'roan.eth',
  'chrisling.eth',
  '0xfA41cadA36A66d2CC457221d7f9a78588bB71625',
]
export class DelegateStore {
  selectedDelegate?: DelegateEntity
  ensInputValue = ''
  selfDelegate?: DelegateEntity
  customDelegate?: DelegateEntity
  loading = false
  delegatesList: DelegateEntity[] = []

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribe()
    this.loadBulk()
  }

  get alreadySelected(): boolean {
    return (
      Boolean(this.selectedDelegate?.delegateAddress) &&
      this.selectedDelegate?.delegateAddress === this.customDelegate?.delegateAddress
    )
  }

  searchEnsName = debounce(async (ensNameOrAddress: string) => {
    if (!ensNameOrAddress) {
      return
    }
    const delegate = await this.fetchProfile(ensNameOrAddress)

    runInAction(() => {
      this.customDelegate = delegate
    })
  }, DEBOUNCE_DELAY_MS)

  setSelectedDelegate(delegate?: DelegateEntity): void {
    runInAction(() => {
      this.selectedDelegate = delegate
    })
  }

  onChangeEnsNameInput({ target: { value } }: React.ChangeEvent<HTMLInputElement>): void {
    this.onChangeEnsName(value)
  }

  onChangeEnsName(value: string): void {
    runInAction(() => {
      this.ensInputValue = value
    })
  }

  async fetchProfile(ensNameOrAddress: string, loadingBulk = false): Promise<DelegateEntity> {
    const delegate = new DelegateEntity(this.root, ensNameOrAddress)
    runInAction(() => {
      this.loading = true
    })
    await delegate.fetchProfile()
    if (!loadingBulk) {
      runInAction(() => {
        this.loading = false
      })
    }

    return delegate
  }

  reset(): void {
    this.ensInputValue = ''
    this.customDelegate = new DelegateEntity(this.root, '')
  }

  loadBulk(): void {
    const addresses = this.root.uiStore.disableMocks ? [] : DELEGATES_LIST_MOCK
    if (addresses.length === 0) {
      return
    }

    let current = 0
    const result: Array<Promise<DelegateEntity>> = []

    const fetchAnotherDelegate = async (): Promise<void> => {
      if (current === addresses.length) {
        // 3.wait for last delegates to be fetched
        const delegates = await Promise.all(result)

        runInAction(() => {
          this.delegatesList = delegates
          this.loading = false
        })
        return
      }
      const address = addresses[current]
      current += 1
      const promise = this.fetchProfile(address, true)
      result.push(promise)
      // 2.when we fetch one delegate, then request another one
      promise.then(() => fetchAnotherDelegate())
    }
    // 1.we run max threads
    for (let i = 0; i < MAX_TREADS; ++i) {
      fetchAnotherDelegate()
    }
  }

  private subscribe(): void {
    reaction(
      () => this.ensInputValue,
      (value) => {
        if (value.length >= MINIMUM_INPUT_LENGTH) {
          this.searchEnsName(value)
        } else {
          this.customDelegate = new DelegateEntity(this.root, '')
        }
      }
    )

    reaction(
      () => this.root.web3Store.signerState.address,
      async (address) => {
        if (address) {
          const delegate = await this.fetchProfile(address)
          this.selfDelegate = delegate
          this.selectedDelegate = delegate
        } else {
          this.selfDelegate = undefined
          this.selectedDelegate = undefined
        }
      }
    )

    reaction(
      () => this.selectedDelegate?.profileFetched,
      (fetched) => {
        this.loading = fetched === false
        if (fetched && this.customDelegate?.ensName && this.customDelegate.delegateAddress) {
          this.ensInputValue = this.customDelegate?.ensName
        }
      }
    )
  }
}
