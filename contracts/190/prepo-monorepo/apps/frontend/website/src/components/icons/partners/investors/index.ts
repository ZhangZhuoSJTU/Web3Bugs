import dynamic from 'next/dynamic'
import { ApolloCapital } from './ApolloCapital'
import BarnBridge from './BarnBridge'
import BetaShare from './BetaShare'
import { CaballerosCapital } from './CaballerosCapital'
import ChargedParticles from './ChargedParticles'
import Debridge from './Debridge'
import Ethereum from './Ethereum'
import { GCR } from './GCR'
import Gelato from './Gelato'
import Gnosis from './Gnosis'
import Immunefi from './Immunefi'
import { Maven11 } from './Maven11'
import { Mexc } from './Mexc'
import Microsoft from './Microsoft'
import { NxGen } from './NxGen'
import OneInch from './OneInch'
import { PossibleVentures } from './PossibleVentures'
import { RepublicCapital } from './RepublicCapital'
import { ShimaCapital } from './ShimaCapital'
import ThalesMarket from './ThalesMarket'
import { ThielCapital } from './Thiel'
import Zapper from './Zapper'
import Zeta from './Zeta'

const AscendEX = dynamic(() => import('./AscendEX'), { ssr: false })
const BerggruenHoldings = dynamic(() => import('./BerggruenHoldings'), { ssr: false })
const Dapp = dynamic(() => import('./Dapp'), { ssr: false })
const DCV = dynamic(() => import('./DCV'), { ssr: false })
const DexterityCapital = dynamic(() => import('./DexterityCapital'), { ssr: false })
const Dialetic = dynamic(() => import('./Dialetic'), { ssr: false })
const Enso = dynamic(() => import('./Enso'), { ssr: false })
const Fleek = dynamic(() => import('./Fleek'), { ssr: false })
const FlexDapps = dynamic(() => import('./FlexDapps'), { ssr: false })
const ForkVentures = dynamic(() => import('./ForkVentures'), { ssr: false })
const GnosisGuild = dynamic(() => import('./GnosisGuild'), { ssr: false })
const HoneyDAO = dynamic(() => import('./HoneyDAO'), { ssr: false })
const HorizonsLaw = dynamic(() => import('./HorizonsLaw'), { ssr: false })
const IOSGVenture = dynamic(() => import('./IosgVenture'), { ssr: false })
const Moonbeam = dynamic(() => import('./Moonbeam'), { ssr: false })
const NeptuneDAO = dynamic(() => import('./NeptuneDAO'), { ssr: false })
const NFTX = dynamic(() => import('./NFTX'), { ssr: false })
const Nonce = dynamic(() => import('./Nonce'), { ssr: false })
const Octav = dynamic(() => import('./Octav'), { ssr: false })
const Re7Capital = dynamic(() => import('./Re7Capital'), { ssr: false })
const Solv = dynamic(() => import('./Solv'), { ssr: false })
const SudoSwap = dynamic(() => import('./SudoSwap'), { ssr: false })
const TheLao = dynamic(() => import('./TheLao'), { ssr: false })
const ToastEth = dynamic(() => import('./ToastEth'), { ssr: false })
const Zepeto = dynamic(() => import('./Zepeto'), { ssr: false })

export default {
  apolloCapital: ApolloCapital,
  ascendEX: AscendEX,
  barnBridge: BarnBridge,
  berggruenHoldings: BerggruenHoldings,
  betaShare: BetaShare,
  caballerosCapital: CaballerosCapital,
  chargedParticles: ChargedParticles,
  dapp: Dapp,
  dcv: DCV,
  debridge: Debridge,
  dexterityCapital: DexterityCapital,
  dialectic: Dialetic,
  enso: Enso,
  ethereum: Ethereum,
  fleek: Fleek,
  flexDapps: FlexDapps,
  forkVentures: ForkVentures,
  gcr: GCR,
  gelato: Gelato,
  gnosis: Gnosis,
  gnosisGuild: GnosisGuild,
  honeyDAO: HoneyDAO,
  horizonsLaw: HorizonsLaw,
  immunefi: Immunefi,
  iosgVenture: IOSGVenture,
  maven11: Maven11,
  mexc: Mexc,
  microsoft: Microsoft,
  moonbeam: Moonbeam,
  neptuneDAO: NeptuneDAO,
  nftx: NFTX,
  nonce: Nonce,
  nxgen: NxGen,
  octav: Octav,
  oneInch: OneInch,
  possibleVentures: PossibleVentures,
  re7Capital: Re7Capital,
  republicCapital: RepublicCapital,
  shimaCapital: ShimaCapital,
  solv: Solv,
  sudoSwap: SudoSwap,
  thalesMarket: ThalesMarket,
  theLao: TheLao,
  thiel: ThielCapital,
  toastEth: ToastEth,
  zapper: Zapper,
  zepeto: Zepeto,
  zeta: Zeta,
}
