import { getAddress, isAddress } from 'ethers/lib/utils'
import { makeAutoObservable, runInAction } from 'mobx'
import { RootStore } from '../RootStore'

const DELEGATE_MOCK_VALUES = {
  delegatorsCount: 0,
  delegatorsPower: 0,
  ppoPower: 0,
}

export class DelegateEntity {
  avatar?: string
  delegateAddress?: string
  delegatorsCount = DELEGATE_MOCK_VALUES.delegatorsCount
  delegatorsPower = DELEGATE_MOCK_VALUES.delegatorsPower
  ensName?: string
  ppoPower = DELEGATE_MOCK_VALUES.ppoPower
  profileFetched = false
  error = false

  // eslint-disable-next-line no-useless-constructor
  constructor(private root: RootStore, public ensNameOrAddress?: string) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get totalPPOPower(): number {
    return this.ppoPower + this.delegatorsPower
  }

  async fetchProfile(nameOrAddress?: string): Promise<void> {
    const name = nameOrAddress ?? this.ensNameOrAddress
    if (!name) {
      return
    }

    runInAction(() => {
      this.profileFetched = false
      this.error = false
      this.ensNameOrAddress = name
    })

    try {
      const address = await this.root.web3Store.coreProvider.resolveName(name)
      const avatar = await this.root.web3Store.coreProvider.getAvatar(name)
      let ensName: string | null = name

      if (isAddress(name)) {
        // We need to make sure that the address given has the right format as a checksum address
        // before checking for reverse lookup
        const checksumAddress = getAddress(name)
        ensName = await this.root.web3Store.coreProvider.lookupAddress(checksumAddress)
      }

      runInAction(() => {
        if (address) this.delegateAddress = address
        if (avatar) this.avatar = avatar
        if (ensName) this.ensName = ensName
        this.profileFetched = true
        this.error = false
      })
    } catch (err) {
      // undefined in tests - to by pass failing warning in tests
      if (process.env.NEXT_PUBLIC_APP_STAGE) {
        // eslint-disable-next-line no-console
        console.error(err)
      }
      runInAction(() => {
        this.profileFetched = true
        this.error = true
      })
    }
  }
}
