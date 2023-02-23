/* eslint-disable @typescript-eslint/no-explicit-any */
import { configure, when } from 'mobx'
import { DelegateEntity } from '../../../stores/entities/DelegateEntity'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const WALLET_DATA = {
  ENS_NAME: 'test.eth',
  ADDRESS: '0x35d803F11E900fb6300946b525f0d08D1Ffd4bed',
  AVATAR: 'https://prepo.io/prepo-logo.svg',
}

const mockedValidAddresses: { [key: string]: string } = {
  'test.eth': '0x35d803F11E900fb6300946b525f0d08D1Ffd4bed',
}

describe('DelegateStore tests', () => {
  let spyResolveName: jest.SpyInstance
  let spyGetAvatar: jest.SpyInstance
  let spyLookupAddress: jest.SpyInstance
  beforeEach(() => {
    spyResolveName = jest.spyOn(rootStore.web3Store.coreProvider, 'resolveName').mockImplementation(
      (nameOrAddress) =>
        new Promise<string | null>((resolve) => {
          if (mockedValidAddresses[nameOrAddress as string]) {
            resolve(mockedValidAddresses[nameOrAddress as string])
          }
          resolve(null)
        })
    )
    spyGetAvatar = jest.spyOn(rootStore.web3Store.coreProvider, 'getAvatar').mockImplementation(
      (nameOrAddress) =>
        new Promise<string | null>((resolve) => {
          if (mockedValidAddresses[nameOrAddress]) {
            // if we have the address in our valid addresses, always expect the default avatar
            resolve(WALLET_DATA.AVATAR)
          }
          resolve(null)
        })
    )
    spyLookupAddress = jest
      .spyOn(rootStore.web3Store.coreProvider, 'lookupAddress')
      .mockImplementation(
        (nameOrAddress) =>
          new Promise<string | null>((resolve) => {
            Object.entries(mockedValidAddresses).forEach(([ensName, address]) => {
              if (address === nameOrAddress) resolve(ensName)
            })
            resolve(null)
          })
      )
  })

  afterEach(() => {
    spyResolveName.mockRestore()
    spyGetAvatar.mockRestore()
    spyLookupAddress.mockRestore()
  })

  it('should default to self delegate', () => {
    expect(rootStore.delegateStore.selectedDelegate).toBe(rootStore.delegateStore.selfDelegate)
  })

  it('should select given delegate', () => {
    const delegate = new DelegateEntity(rootStore, '')
    rootStore.delegateStore.setSelectedDelegate(delegate)
    expect(rootStore.delegateStore.selectedDelegate).toBe(delegate)
  })

  it('should search for delegate address', async () => {
    const event = { target: { value: WALLET_DATA.ENS_NAME } } as any
    rootStore.delegateStore.onChangeEnsNameInput(event)
    await when(() => !!rootStore.delegateStore.customDelegate?.profileFetched)

    expect(rootStore.delegateStore.customDelegate?.delegateAddress).toBe(WALLET_DATA.ADDRESS)
  })

  it('should return return true when select already selected address', async () => {
    const event = { target: { value: WALLET_DATA.ENS_NAME } } as any
    rootStore.delegateStore.onChangeEnsNameInput(event)
    await when(() => !!rootStore.delegateStore.customDelegate?.profileFetched)
    rootStore.delegateStore.setSelectedDelegate(rootStore.delegateStore.customDelegate)

    expect(rootStore.delegateStore.alreadySelected).toBe(true)
  })

  it('should return empty address when not found from ens name', async () => {
    const event = { target: { value: 'prepo.eth' } } as any
    rootStore.delegateStore.onChangeEnsNameInput(event)
    await when(() => !rootStore.delegateStore.customDelegate?.delegateAddress)
    expect(rootStore.delegateStore.customDelegate?.delegateAddress).toBe(undefined)
  })

  it('should return empty address when invalid address is given', async () => {
    const event = { target: { value: '0x1231232123' } } as any
    rootStore.delegateStore.onChangeEnsNameInput(event)
    await when(() => !rootStore.delegateStore.customDelegate?.delegateAddress)

    expect(rootStore.delegateStore.customDelegate?.delegateAddress).toBe(undefined)
  })

  describe('searchEnsName', () => {
    const mock: any = (): jest.Mock<void> => jest.fn()
    let spySearchEnsName: jest.SpyInstance

    beforeEach(() => {
      spySearchEnsName = jest.spyOn(rootStore.delegateStore, 'searchEnsName')
      spySearchEnsName.mockImplementation(mock)
    })

    afterEach(() => {
      spySearchEnsName.mockRestore()
    })

    it('should not search if is less than 5 characters on the input field', () => {
      const event = { target: { value: 'test' } } as any
      rootStore.delegateStore.onChangeEnsNameInput(event)

      expect(rootStore.delegateStore.searchEnsName).toHaveBeenCalledTimes(0)
    })

    it('should search if is more than 5 characters on the input field', () => {
      const event = { target: { value: 'testtest' } } as any
      rootStore.delegateStore.onChangeEnsNameInput(event)
      expect(rootStore.delegateStore.searchEnsName).toHaveBeenCalledTimes(1)
    })
  })
})
