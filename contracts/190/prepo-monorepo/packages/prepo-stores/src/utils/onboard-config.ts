import { InitOptions } from '@web3-onboard/core'
import injectedModule from '@web3-onboard/injected-wallets'
import walletConnectModule from '@web3-onboard/walletconnect'
import coinbaseWalletModule from '@web3-onboard/coinbase'
import { Network } from 'prepo-constants'
import { chainIdToHexString } from 'prepo-utils'

const injected = injectedModule()
const walletConnect = walletConnectModule({
  qrcodeModalOptions: {
    mobileLinks: ['rainbow', 'metamask', 'argent', 'trust', 'imtoken', 'pillar'],
  },
  connectFirstChainId: true,
})
const coinbaseWallet = coinbaseWalletModule({ darkMode: false })

const IconString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 547.64 625.35"><defs><linearGradient id="a" x1="175.92" y1="646.69" x2="175.92" y2="-18.7" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#454699"/><stop offset="1" stop-color="#6264d9"/></linearGradient><linearGradient id="b" x1="307.54" y1="646.69" x2="307.54" y2="-18.7" href="#a"/><linearGradient id="c" x1="240.01" y1="646.69" x2="240.01" y2="-18.7" href="#a"/><linearGradient id="d" x1="370.94" y1="646.69" x2="370.94" y2="-18.7" href="#a"/></defs><g data-name="layer 2"><g data-name="layer 1"><path fill="url(#a)" d="m349.67 253-26.47 27.06a7.58 7.58 0 0 1-10.84 0l-34.24-35a7.58 7.58 0 0 0-10.86 0l-39.08 40.35-26.38 27.27-36.92 38.13L138.5 378l-42.15 43.46-27.14 28-33.94 35a7.58 7.58 0 0 1-9.27 1.35l-15.57-9-6.68-3.87A7.58 7.58 0 0 1 0 466.37V450.8a15.16 15.16 0 0 1 4.28-10.55l48.79-50.32L91 350.81l10.54-10.92 26.38-27.21 37-38.13 26.38-27.21 70.35-72.65a15.16 15.16 0 0 1 21.73-.06l66.33 67.79a7.58 7.58 0 0 1-.04 10.58Z"/><path fill="url(#b)" d="M547.64 243.46v214.19a22.74 22.74 0 0 1-11.41 19.72l-252.31 145a22.74 22.74 0 0 1-22.74 0L69.53 511.1a4.19 4.19 0 0 1-.91-6.54l30.2-31.16a7.58 7.58 0 0 1 9.25-1.28l160.82 93.3a7.58 7.58 0 0 0 7.58 0l214.3-123.12a7.58 7.58 0 0 0 3.8-6.57V292.34a7.58 7.58 0 0 1 2.16-5.3l45-46a3.46 3.46 0 0 1 5.91 2.42Z"/><path fill="url(#c)" d="m478.82 121-30.4 31.12a7.58 7.58 0 0 1-9.2 1.28L276.48 59.92a7.58 7.58 0 0 0-7.58 0L56.84 183a7.58 7.58 0 0 0-3.78 6.56v142.79a7.58 7.58 0 0 1-2.13 5.27l-45 46.47a3.46 3.46 0 0 1-5.93-2.4v-214A22.74 22.74 0 0 1 11.33 148L261.18 3a22.74 22.74 0 0 1 22.74 0l194 111.45a4.19 4.19 0 0 1 .9 6.55Z"/><path fill="url(#d)" d="M547.64 158.92v15.59a15.16 15.16 0 0 1-4.33 10.61l-48.74 49.78-37.9 38.74-11.6 11.9-26.61 27.14-37.07 37.9-26.53 27.06-71.51 73.09a15.16 15.16 0 0 1-21.73-.06l-65.25-67.37a7.58 7.58 0 0 1 0-10.55l26.37-27.24a7.58 7.58 0 0 1 10.89 0l33.64 34.72a7.58 7.58 0 0 0 10.86 0l39.66-40.53 26.53-27.06 37.07-37.9 26.53-27.14 42.91-43.82 27.37-28 34.25-35a7.58 7.58 0 0 1 9.2-1.27l15.61 9 6.59 3.8a7.58 7.58 0 0 1 3.79 6.61Z"/></g></g></svg>`

export const getOnboardConfig = (supportedChains: Network[], appName: string): InitOptions => ({
  wallets: [injected, coinbaseWallet, walletConnect],
  chains: supportedChains.map(({ chainId, chainName, rpcUrls }) => ({
    id: chainIdToHexString(chainId),
    label: chainName,
    rpcUrl: rpcUrls[0],
    token: 'ETH',
  })),
  appMetadata: {
    name: appName,
    icon: IconString,
    description: 'Welcome to prePO',
    recommendedInjectedWallets: [
      { name: 'MetaMask', url: 'https://metamask.io' },
      { name: 'Coinbase', url: 'https://wallet.coinbase.com/' },
    ],
  },
  accountCenter: {
    desktop: {
      enabled: false,
    },
    mobile: {
      enabled: false,
    },
  },
})
