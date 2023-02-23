import dynamic from 'next/dynamic'
import { ArrowRightRoundIcon } from './ArrowRightRoundIcon'
import { DiscordIcon } from './DiscordIcon'
import { FacebookIcon } from './FacebookIcon'
import { InstagramIcon } from './InstagramIcon'
import { LinkedInIcon } from './LinkedInIcon'
import { MediumIcon } from './MediumIcon'
import { RedditIcon } from './RedditIcon'
import { TwitterIcon } from './TwitterIcon'
import { YouTubeIcon } from './YouTubeIcon'
import { BubbleIcon } from './BubbleIcon'
import { BurgerIcon } from './BurgerIcon'
import { CrossIcon } from './CrossIcon'
import { PPOIcon } from './PpoIcon'
import { ChevronRightRoundIcon } from './ChevronRightRoundIcon'
import { EarnIcon } from './EarnIcon'
import { SpendIcon } from './SpendIcon'
import { TimelockIcon } from './TimelockIcon'
import { SpinnerIcon } from './SpinnerIcon'
import { AccessIcon } from './AccessIcon'
import { DummyIcon } from './DummyIcon'
import { MiddleEastIcon } from './MiddleEastIcon'
import { MoneyBagIcon } from './MoneyBagIcon'
import { DoubleArrowUpIcon } from './DoubleArrowUpIcon'
import { GiftIcon } from './GiftIcon'
import { GithubIcon } from './GithubIcon'
import { MedalIcon } from './MedalIcon'
import { PeopleBoxIcon } from './PeopleBoxIcon'
import { SocialDiscordIcon } from './SocialDiscordIcon.tsx'
import { SocialTwitterIcon } from './SocialTwitterIcon.tsx copy'
import { PlusIcon } from './PlusIcon'
import { FusionIcon } from './FusionIcon'
import { ShieldIcon } from './ShieldIcon'
import { Aave } from './partners/Aave'
import investors from './partners/investors'
import { MeldVentures } from './partners/MeldVentures'
import { MStable } from './partners/MStable'
import { OpenSea } from './partners/OpenSea'
import { Polygon } from './partners/Polygon'
import { Uniswap } from './partners/Uniswap'
import { GoodGhosting } from './partners/GoodGhosting'
import { CrystalFinance } from './partners/CrystalFinance'
import { AnytimeIcon } from './AnytimeIcon'
import { AssetsIcon } from './AssetsIcon'
import { CrystalBallIcon } from './CrystalBallIcon'
import { GameIcon } from './GameIcon'
import { GrowIcon } from './GrowIcon'
import { HatPersonIcon } from './HatPersonIcon'
import { PeopleIcon } from './PeopleIcon'
import { PodiumIcon } from './PodiumIcon'
import { PuzzleIcon } from './PuzzleIcon'
import { RocketIcon } from './RocketIcon'
import { RocketDocumentIcon } from './RocketDocumentIcon'
import { SpannerIcon } from './SpannerIcon'
import { SpeechBubbleIcon } from './SpeechBubbleIcon'
import { TropheyIcon } from './TropheyIcon'
import { Talisman } from './partners/Talisman'
import { Alchemix } from './partners/Alchemix'
import { ShareIcon } from './ShareIcon'
import { SocietyOne } from './partners/SocietyOne'
import { ZedRun } from './partners/ZedRun'
import { TelescopeIcon } from './TelescopeIcon'
import { TelegramIcon } from './TelegramIcon'
import { PPOGraphic } from './PPOGraphic'

// lazy load large svg with png embedded
const DHedge = dynamic(() => import('./partners/DHedge'), { ssr: false })
const FireEyes = dynamic(() => import('./partners/FireEyes'), { ssr: false })
const Illuvium = dynamic(() => import('./partners/Illuvium'), { ssr: false })
const Koji = dynamic(() => import('./partners/Koji'), { ssr: false })
const Paperclip = dynamic(() => import('./partners/Paperclip'), { ssr: false })
const Sushi = dynamic(() => import('./partners/Sushi'), { ssr: false })
const DappRadar = dynamic(() => import('./partners/DappRadar'), { ssr: false })
const Cometh = dynamic(() => import('./partners/Cometh'), { ssr: false })
const Seascape = dynamic(() => import('./partners/Seascape'), { ssr: false })
const EvolutionLand = dynamic(() => import('./partners/EvolutionLand'), { ssr: false })
const PolygonPunks = dynamic(() => import('./partners/PolygonPunks'), { ssr: false })
const FirebirdFinance = dynamic(() => import('./partners/FirebirdFinance'), { ssr: false })
const G4n9 = dynamic(() => import('./partners/G4n9'), { ssr: false })

export default {
  // social
  discord: DiscordIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedIn: LinkedInIcon,
  github: GithubIcon,
  medium: MediumIcon,
  reddit: RedditIcon,
  telegram: TelegramIcon,
  twitter: TwitterIcon,
  youTube: YouTubeIcon,
  socialDiscord: SocialDiscordIcon,
  socialTwitter: SocialTwitterIcon,

  // utils
  arrowRightRound: ArrowRightRoundIcon,
  chevronRightRound: ChevronRightRoundIcon,
  doubleArrowUp: DoubleArrowUpIcon,
  burger: BurgerIcon,
  cross: CrossIcon,
  plus: PlusIcon,
  spinner: SpinnerIcon,

  // governance
  ppo: PPOIcon,
  ppoGraphic: PPOGraphic,
  earn: EarnIcon,
  spend: SpendIcon,
  timelock: TimelockIcon,

  // partners
  aave: Aave,
  alchemix: Alchemix,
  dHedge: DHedge,
  fireEyes: FireEyes,
  illuvium: Illuvium,
  koji: Koji,
  meldVentures: MeldVentures,
  mStable: MStable,
  openSea: OpenSea,
  paperclip: Paperclip,
  polygon: Polygon,
  talisman: Talisman,
  uniswap: Uniswap,
  societyOne: SocietyOne,
  sushi: Sushi,
  dappRadar: DappRadar,
  zedRun: ZedRun,

  // collaborators
  goodGhosting: GoodGhosting,
  cometh: Cometh,
  seascape: Seascape,
  evolutionLand: EvolutionLand,
  polygonPunks: PolygonPunks,
  crystlFinance: CrystalFinance,
  firebirdFinance: FirebirdFinance,
  g4n9: G4n9,

  // other
  access: AccessIcon,
  bubble: BubbleIcon,
  dummy: DummyIcon,
  gift: GiftIcon,
  medal: MedalIcon,
  middleEast: MiddleEastIcon,
  moneyBag: MoneyBagIcon,
  peopleBox: PeopleBoxIcon,
  fusion: FusionIcon,
  shield: ShieldIcon,
  anytime: AnytimeIcon,
  assets: AssetsIcon,
  crystalBall: CrystalBallIcon,
  game: GameIcon,
  grow: GrowIcon,
  hatPerson: HatPersonIcon,
  people: PeopleIcon,
  podium: PodiumIcon,
  puzzle: PuzzleIcon,
  rocket: RocketIcon,
  'rocket-document': RocketDocumentIcon,
  shareIcon: ShareIcon,
  spanner: SpannerIcon,
  speechBubble: SpeechBubbleIcon,
  telescope: TelescopeIcon,
  trophey: TropheyIcon,

  ...investors,
}
