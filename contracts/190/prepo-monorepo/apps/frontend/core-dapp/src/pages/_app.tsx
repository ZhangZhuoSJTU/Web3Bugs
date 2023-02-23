import { configure } from 'mobx'
import { AppProps } from 'next/app'
import { usePanelbear } from '@panelbear/panelbear-nextjs'
import { I18nProvider } from '@lingui/react'
import { useRouter } from 'next/router'
import { DEFAULT_LANGUAGE } from 'prepo-constants'
import { useEffect } from 'react'

import { i18n } from '@lingui/core'
import Layout from '../components/layout/Layout'
import AppBootstrap from '../components/AppBootstrap'
import { RootStoreProvider } from '../context/RootStoreProvider'

import 'antd/dist/antd.css'
import 'react-loading-skeleton/dist/skeleton.css'
import { LightWeightChartProvider } from '../components/charts'
import '../styles/default.css'
import config from '../lib/config'

// mobx config
configure({
  enforceActions: 'observed',
  computedRequiresReaction: true,
  reactionRequiresObservable: false,
  observableRequiresReaction: false,
  disableErrorBoundaries: false,
})

const App = ({ Component, pageProps }: AppProps): React.ReactElement => {
  usePanelbear(config.PANELBEAR_SDK_KEY, { scriptSrc: '/bear.js', analyticsHost: '/api/bear' })
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
    <RootStoreProvider>
      <I18nProvider i18n={i18n}>
        <LightWeightChartProvider>
          <AppBootstrap>
            <Layout>
              {/* eslint-disable-next-line react/jsx-props-no-spreading */}
              <Component {...pageProps} />
            </Layout>
          </AppBootstrap>
        </LightWeightChartProvider>
      </I18nProvider>
    </RootStoreProvider>
  )
}

export default App
