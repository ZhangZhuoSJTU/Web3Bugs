import { t } from '@lingui/macro'
import { IconName } from 'prepo-ui'
import { Routes } from '../../lib/routes'

export type PpoItem = {
  href: string
  title: string
  iconName: IconName
  target?: '_blank'
}

export const ppoItems: PpoItem[] = [
  { iconName: 'stake', title: t`Stake`, href: Routes.Stake },
  { iconName: 'legal', title: t`Govern`, href: Routes.Govern },
  { iconName: 'shopping-cart-arrow-down', title: t`Buy`, href: Routes.Buy },
  { iconName: 'shopping-cart-arrow-right', title: t`Spend`, href: Routes.Withdraw },
  { iconName: 'growth', title: t`Trade to Earn`, href: '' },
  { iconName: 'water-drop', title: t`LP to Earn`, href: '' },
  { iconName: 'history', title: t`History`, href: Routes.History },
  { iconName: 'charts-line', title: t`Analytics`, href: '', target: '_blank' },
]
