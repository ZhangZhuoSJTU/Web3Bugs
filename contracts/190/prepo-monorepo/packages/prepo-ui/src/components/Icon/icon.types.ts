import { applicationIcons } from './icon-components/application'
import { currencyIcons } from './icon-components/currencies'
import { emojisIcons } from './icon-components/emojis'
import { socialMediaIcons } from './icon-components/social-media'
import { marketsIcons } from './icon-components/markets'
import { cexIcons } from './icon-components/cex'
import { networksIcons } from './icon-components/networks'
import { brandIcons } from './icon-components/brands'

export type ApplicationIcons = keyof typeof applicationIcons
export type BrandIcons = keyof typeof brandIcons
export type CexIcons = keyof typeof cexIcons
export type CurrencyIcons = keyof typeof currencyIcons
export type EmojisIcons = keyof typeof emojisIcons
export type MarketsIcons = keyof typeof marketsIcons
export type NetworkIcons = keyof typeof networksIcons
export type SocialMediaIcons = keyof typeof socialMediaIcons

export type IconName =
  | ApplicationIcons
  | BrandIcons
  | CexIcons
  | CurrencyIcons
  | EmojisIcons
  | MarketsIcons
  | NetworkIcons
  | SocialMediaIcons

export type IconProps = {
  id?: string
  name: IconName
  onClick?: () => void
  color?: string
  height?: string
  width?: string
  disabled?: boolean
}
