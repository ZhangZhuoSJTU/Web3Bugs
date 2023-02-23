import { runInAction, makeAutoObservable, autorun } from 'mobx'
import { BigNumber, ethers } from 'ethers'
import { isAddress } from 'ethers/lib/utils'
import Onboard, { OnboardAPI, WalletState } from '@web3-onboard/core'
import { Network, IS_BROWSER, NETWORKS } from 'prepo-constants'
import { createFallbackProvider, chainIdToHexString } from 'prepo-utils'
import { RootStore } from './RootStore'
import { TransactionReceipt } from './utils/stores.types'
import { isImportantError } from './utils/error-capturer-util'

type SignerState = {
  address: string | undefined
  balance: BigNumber | undefined
}

type Ens = WalletState['accounts'][number]['ens']

export class Web3Store {
  root: RootStore<unknown>
  blockNumber: number | undefined = undefined
  currentNetworkId?: number
  coreProvider: ethers.providers.FallbackProvider
  signer: ethers.providers.JsonRpcSigner | undefined = undefined
  signerState: SignerState = {
    address: undefined,
    balance: undefined,
  }
  unsubscribeFromWalletChange: (() => void) | undefined = undefined
  connecting = false
  onboardEns: Ens | undefined = undefined
  onboard: OnboardAPI
  walletState?: WalletState

  constructor(root: RootStore<unknown>) {
    this.root = root
    this.coreProvider = createFallbackProvider(root.config.defaultNetwork)
    this.onboard = Onboard(this.root.config.onboardConfig)
    makeAutoObservable(this, {}, { autoBind: true })

    this.init()
  }

  init(): void {
    if (!IS_BROWSER) return
    // If user has connected before, connect to their previous wallet
    const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')
    if (previouslySelectedWallet) {
      this.connect(previouslySelectedWallet)
    }

    // Init event listeners
    this.coreProvider.on('block', this.handleNewBlock.bind(this))
    this.coreProvider.on('error', (error) => {
      if (isImportantError(error)) this.root.toastStore.errorToast(error.reason, error)
    })

    // Refetch state immediately when tab switches from inactive to active
    // (check multicallStore exists so we don't exec this on mount)
    autorun(() => {
      if (!this.root.browserStore.tabIsInactive && this.root.multicallStore) {
        this.refreshChainState()
      }
    })
  }

  handleNewBlock(n: number): void {
    if (this.root.browserStore.tabIsInactive) return
    try {
      this.blockNumber = n
      this.refreshChainState()
    } catch (error) {
      this.root.toastStore.errorToast('Error handling new block', error)
    }
  }

  wait(hash: string): Promise<TransactionReceipt> {
    return this.coreProvider.waitForTransaction(hash)
  }

  refreshChainState(): void {
    this.refreshSignerBalance()
    this.root.multicallStore.call()
  }

  get supportedNetworkIds(): { [key: number]: Network } {
    const supportedIds: { [key: number]: Network } = {}
    this.root.config.supportedNetworks.forEach((network) => {
      supportedIds[network.chainId] = network
    })
    return supportedIds
  }

  get isNetworkSupported(): boolean {
    if (this.currentNetworkId === undefined) return true
    return Boolean(this.supportedNetworkIds[this.currentNetworkId])
  }

  getBlockExplorerUrl(hash: string): string {
    const type = isAddress(hash) ? 'address' : 'tx'
    let explorer = NETWORKS[this.network.name].blockExplorer
    if (explorer[explorer.length - 1] === '/') explorer = explorer.slice(0, -1)

    return `${explorer}/${type}/${hash}`
  }

  async refreshSignerBalance(): Promise<void> {
    try {
      if (!this.signerState.address) return
      const balance = await this.coreProvider.getBalance(this.signerState.address)
      runInAction(() => {
        this.signerState.balance = balance
      })
    } catch (error) {
      if (isImportantError(error))
        this.root.toastStore.errorToast('Error refreshing wallet balance', error)
    }
  }

  async refreshSignerAddress(): Promise<void> {
    try {
      if (!this.signer) return
      const address = await this.signer.getAddress()
      runInAction(() => {
        this.signerState.address = address
      })
    } catch (error) {
      window.localStorage.removeItem('selectedWallet')
      this.root.toastStore.errorToast('Error fetching signer address', error)
    }
  }

  async connect(walletName?: string): Promise<void> {
    if (this.connecting) return
    this.connecting = true
    try {
      const walletState: WalletState[] = await this.onboard.connectWallet(
        walletName ? { autoSelect: walletName } : undefined
      )

      // Onboard wallet connection successful
      if (this.onboard && walletState.length) {
        this.handleConnected(walletState)

        this.setNetwork(this.network)
        if (this.unsubscribeFromWalletChange) this.unsubscribeFromWalletChange()

        const walletsSub = this.onboard.state.select('wallets')
        this.unsubscribeFromWalletChange = walletsSub.subscribe(this.handleConnected).unsubscribe
        return
      }

      // Something went wrong connecting the wallet
      if (!this.onboard)
        this.root.toastStore.errorToast(
          'Wallet connection cancelled',
          Error(`Something went wrong`)
        )

      this.disconnect()
    } catch (e) {
      this.disconnect()
      const error = this.root.captureError(e)
      this.root.toastStore.errorToast('Error connecting wallet', error.message)
    } finally {
      runInAction(() => {
        this.connecting = false
      })
    }
  }

  handleConnected(walletState: WalletState[]): void {
    if (!walletState || !walletState.length) {
      this.disconnect()
      return
    }
    const [wallet] = walletState
    const { ens } = wallet.accounts[0]
    const { id } = wallet.chains[0]
    const signer = new ethers.providers.Web3Provider(wallet.provider).getSigner()

    window.localStorage.setItem('selectedWallet', wallet.label)
    this.walletState = wallet
    this.signer = signer
    this.currentNetworkId = +id
    this.refreshSignerAddress()
    this.refreshSignerBalance()
    if (this.onboardEns?.name !== ens?.name) this.onboardEns = ens
  }

  disconnect(): void {
    this.signer = undefined
    this.currentNetworkId = undefined
    this.signerState = {
      address: undefined,
      balance: undefined,
    }
    window.localStorage.removeItem('selectedWallet')
    this.walletState = undefined
    this.connecting = false
    if (this.onboard) {
      const { wallets } = this.onboard.state.get()
      if (!wallets.length) {
        return
      }
      this.onboard.disconnectWallet({ label: wallets[0].label })
    }
  }

  checkSigner(): Promise<boolean | void> {
    if (!this.onboard.state?.get().wallets.length) return Promise.resolve()
    return Promise.resolve(true)
  }

  setNetwork(network: Network): void {
    this.onboard.setChain({ chainId: chainIdToHexString(network.chainId) })
  }

  get address(): string | undefined {
    return this.signerState.address
  }

  get connected(): boolean {
    return Boolean(this.signerState.address)
  }

  get formattedBalance(): string {
    return ethers.utils.formatEther(this.signerState.balance || 0)
  }

  get network(): Network {
    if (this.currentNetworkId === undefined) return this.root.config.defaultNetwork
    return this.supportedNetworkIds[this.currentNetworkId] ?? this.root.config.defaultNetwork
  }
}
