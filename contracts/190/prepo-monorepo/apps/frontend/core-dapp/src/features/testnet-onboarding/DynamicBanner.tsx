import { observer } from 'mobx-react-lite'
import TokenSaleWhitelistBanner from './TokenSaleWhitelistBanner'
import OnboardUserBanner from './OnboardUserBanner'
import { useRootStore } from '../../context/RootStoreProvider'
import { FAKEUSD_AIRDROPPED_ON_TESTNET } from '../../lib/constants'

const DynamicBanner: React.FC = () => {
  const {
    preCTTokenStore,
    baseTokenStore,
    portfolioStore,
    web3Store: {
      network: { testNetwork = true },
      signerState,
    },
  } = useRootStore()

  const walletDisconnected = !signerState.address
  if (walletDisconnected) return <TokenSaleWhitelistBanner />

  const amountFakeUSD = baseTokenStore.parseUnits(`${FAKEUSD_AIRDROPPED_ON_TESTNET}`)
  if (amountFakeUSD === undefined) return null

  const userHasNotUsedAirdroppedTokens = baseTokenStore.balanceOfSigner?.eq(amountFakeUSD)
  const userHasBeenOnboarded =
    portfolioStore.positions.length > 0 || preCTTokenStore.balanceOfSigner?.gt(0)

  if (userHasBeenOnboarded) return null
  if (testNetwork && userHasNotUsedAirdroppedTokens) return <OnboardUserBanner />

  // User wallet is connected but has no tokens or has not used the dApp before
  return <TokenSaleWhitelistBanner />
}

export default observer(DynamicBanner)
