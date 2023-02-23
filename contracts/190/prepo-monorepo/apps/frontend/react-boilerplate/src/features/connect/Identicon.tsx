import { observer } from 'mobx-react-lite'
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon'
import { useRootStore } from '../../context/RootStoreProvider'

const Identicon: React.FC = () => {
  const { web3Store } = useRootStore()
  const { signerState } = web3Store
  const account = signerState.address
  if (!account) return null

  return <Jazzicon diameter={15} seed={jsNumberForAddress(account)} />
}

export default observer(Identicon)
