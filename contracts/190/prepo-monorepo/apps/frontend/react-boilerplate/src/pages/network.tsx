import { NETWORKS } from 'prepo-constants'
import { useEffect } from 'react'
import { useRootStore } from '../context/RootStoreProvider'

// Remove this page when starting a new project
const Network: React.FC = () => {
  const { web3Store } = useRootStore()
  useEffect(() => {
    web3Store.setNetwork(NETWORKS.kovan)
  }, [web3Store])

  return <div>Network change example</div>
}

export default Network
