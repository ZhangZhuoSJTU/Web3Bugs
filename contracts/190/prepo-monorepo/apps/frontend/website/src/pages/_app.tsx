import { ToastContainer } from 'react-toastify'
import { configure } from 'mobx'
import { AppProps } from 'next/app'
import { usePanelbear } from '@panelbear/panelbear-nextjs'
import { RootStoreProvider } from '../context/RootStoreProvider'

import 'react-toastify/dist/ReactToastify.css'
import 'tailwindcss/tailwind.css'
import '../styles/default.css'
import { PANELBEAR_SITE_ID } from '../lib/constants'

// mobx config
configure({
  enforceActions: 'observed',
  computedRequiresReaction: true,
  disableErrorBoundaries: false,
  // Disable these rules to prevent warnings logged due to mst-gql dependency
  reactionRequiresObservable: false,
  observableRequiresReaction: false,
})

const App = ({ Component, pageProps }: AppProps): React.ReactElement => {
  usePanelbear(PANELBEAR_SITE_ID, {
    scriptSrc: '/bear.js',
    analyticsHost: '/api/bear',
  })
  return (
    <>
      <RootStoreProvider>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <Component {...pageProps} />
      </RootStoreProvider>
      <ToastContainer />
    </>
  )
}

export default App
