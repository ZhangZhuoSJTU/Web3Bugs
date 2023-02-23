import { Literal, Union, Static } from 'runtypes'
import StripeLogo from '../../assets/images/stripe-logo.svg'
import SpacexLogo from '../../assets/images/spacex-logo.svg'
import DiscordLogo from '../../assets/images/discord-logo.svg'
import EpicGamesLogo from '../../assets/images/epic-games-logo.svg'
import BoringCompanyLogo from '../../assets/images/boring-company-logo.svg'
import RedditLogo from '../../assets/images/reddit-logo.png'
import FTXLogo from '../../assets/images/ftx-logo.png'
import CoinGeckoLogo from '../../assets/images/coingecko-logo.png'
import MatchaLogo from '../../assets/images/matcha-logo.png'
import MetaMaskLogo from '../../assets/images/metamask-logo.png'
import OpenSeaLogo from '../../assets/images/opensea-logo.svg'
import OptimismLogo from '../../assets/images/optimism-logo.svg'
import ZapperLogo from '../../assets/images/zapper-logo.png'

export type Bounds = { floor: number; ceil: number }

export type MarketType = 'preipo' | 'pretoken' | 'custom'

export const MarketNameConstant = Union(
  Literal('SpaceX'),
  Literal('Stripe'),
  Literal('Epic Games'),
  Literal('The Boring Company'),
  Literal('Discord'),
  Literal('Reddit'),
  Literal('FTX'),
  Literal('OpenSea'),
  Literal('MetaMask'),
  Literal('Optimism'),
  Literal('Zapper'),
  Literal('CoinGecko'),
  Literal('Matcha'),
  Literal('Custom Market')
)
export type MarketName = Static<typeof MarketNameConstant>

export interface Market {
  name: MarketName
  logo: {
    src: string
  }
  bounds: {
    valuation: Bounds
  }
  type: MarketType
}

const markets: Map<MarketName, Market> = new Map<MarketName, Market>([
  [
    'SpaceX',
    {
      name: 'SpaceX',
      logo: {
        src: SpacexLogo,
      },
      bounds: {
        valuation: {
          floor: 100,
          ceil: 400,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'Stripe',
    {
      name: 'Stripe',
      logo: {
        src: StripeLogo,
      },
      bounds: {
        valuation: {
          floor: 100,
          ceil: 150,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'Epic Games',
    {
      name: 'Epic Games',
      logo: {
        src: EpicGamesLogo,
      },
      bounds: {
        valuation: {
          floor: 40,
          ceil: 100,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'The Boring Company',
    {
      name: 'The Boring Company',
      logo: {
        src: BoringCompanyLogo,
      },
      bounds: {
        valuation: {
          floor: 1,
          ceil: 4,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'Discord',
    {
      name: 'Discord',
      logo: {
        src: DiscordLogo,
      },
      bounds: {
        valuation: {
          floor: 15,
          ceil: 45,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'Reddit',
    {
      name: 'Reddit',
      logo: {
        src: RedditLogo,
      },
      bounds: {
        valuation: {
          floor: 10,
          ceil: 40,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'FTX',
    {
      name: 'FTX',
      logo: {
        src: FTXLogo,
      },
      bounds: {
        valuation: {
          floor: 20,
          ceil: 80,
        },
      },
      type: 'preipo',
    },
  ],
  [
    'OpenSea',
    {
      name: 'OpenSea',
      logo: {
        src: OpenSeaLogo,
      },
      bounds: {
        valuation: {
          floor: 10,
          ceil: 20,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'MetaMask',
    {
      name: 'MetaMask',
      logo: {
        src: MetaMaskLogo,
      },
      bounds: {
        valuation: {
          floor: 15,
          ceil: 45,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'Optimism',
    {
      name: 'Optimism',
      logo: {
        src: OptimismLogo,
      },
      bounds: {
        valuation: {
          floor: 10,
          ceil: 25,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'Zapper',
    {
      name: 'Zapper',
      logo: {
        src: ZapperLogo,
      },
      bounds: {
        valuation: {
          floor: 0.5,
          ceil: 1.5,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'CoinGecko',
    {
      name: 'CoinGecko',
      logo: {
        src: CoinGeckoLogo,
      },
      bounds: {
        valuation: {
          floor: 1,
          ceil: 5,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'Matcha',
    {
      name: 'Matcha',
      logo: {
        src: MatchaLogo,
      },
      bounds: {
        valuation: {
          floor: 0.1,
          ceil: 0.5,
        },
      },
      type: 'pretoken',
    },
  ],
  [
    'Custom Market',
    {
      name: 'Custom Market',
      logo: {
        src: 'none',
      },
      bounds: {
        valuation: {
          floor: 1,
          ceil: 5,
        },
      },
      type: 'custom',
    },
  ],
])

export default markets
