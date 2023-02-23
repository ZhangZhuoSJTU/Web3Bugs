import { message } from 'antd'
import { RootStore as PRootStore, LocalStorageStore } from 'prepo-stores'
import { UiStore } from './UiStore'
import { UniswapV2RouterContractStore } from './UniswapV2RouterContractStore'
import { Erc20Store } from './entities/Erc20.entity'
import UniswapV3GraphStore from './UniswapV3GraphStore'
import { storeConfig } from '../lib/stores-config'
import { PROJECT_NAME } from '../lib/constants'
import { SwapStore } from '../features/swap/SwapStore'
import { SupportedThemes } from '../utils/theme/theme.types'
import { SupportedContracts } from '../lib/contract.types'

type LocalStorage = {
  selectedTheme: SupportedThemes
  selectedWallet: string | undefined
}

const initLocalStorage: LocalStorage = {
  selectedTheme: 'light',
  selectedWallet: undefined,
}

export class RootStore extends PRootStore<SupportedContracts> {
  uiStore: UiStore
  swapStore: SwapStore
  uniswapV2RouterContractStore: UniswapV2RouterContractStore
  localStorageStore: LocalStorageStore<LocalStorage>
  usdcStore: Erc20Store
  graphs: {
    uniswapV3: UniswapV3GraphStore
  }

  constructor() {
    super({
      toast: message,
      storeConfig,
    })
    this.localStorageStore = new LocalStorageStore(this, PROJECT_NAME, initLocalStorage)
    this.uiStore = new UiStore(this)
    this.swapStore = new SwapStore(this)
    this.uniswapV2RouterContractStore = new UniswapV2RouterContractStore(this)
    this.usdcStore = new Erc20Store(this, 'USDC', 'usdcStore')
    this.graphs = {
      uniswapV3: new UniswapV3GraphStore(this),
    }
  }
}
