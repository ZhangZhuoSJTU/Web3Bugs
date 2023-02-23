import { configure } from 'mobx'
import { AppProps } from 'next/app'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { DEFAULT_LANGUAGE } from 'prepo-constants'
import { RootStoreProvider } from '../context/RootStoreProvider'
import AppBootstrap from '../components/AppBootstrap'
import Layout from '../components/layout'

import 'antd/dist/antd.css'
import '../styles/default.css'

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
  const { locale = DEFAULT_LANGUAGE } = useRouter()

  useEffect(() => {
    async function load(localeCode: string): Promise<void> {
      const { messages } = await import(`../locale/${localeCode}/messages.po`)

      i18n.load(localeCode, messages)
      i18n.activate(localeCode)
    }

    load(locale)
  }, [locale])

  return (
    <I18nProvider i18n={i18n}>
      <RootStoreProvider>
        <AppBootstrap>
          <Layout>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <Component {...pageProps} />
          </Layout>
        </AppBootstrap>
      </RootStoreProvider>
    </I18nProvider>
  )
}

export default App
