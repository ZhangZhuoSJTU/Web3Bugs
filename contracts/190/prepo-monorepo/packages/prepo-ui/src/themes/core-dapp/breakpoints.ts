import { Sizes } from '../../common-utils'

export type BreakpontObjectType = {
  phone: string
  tablet: string
  desktop: string
  largeDesktop: string
}

export type BreakpointType = [string, string, string, string] & BreakpontObjectType

export const breakpoints: BreakpointType = [
  `0px`,
  `${Sizes.tablet}px`,
  `${Sizes.desktop}px`,
  `${Sizes.largeDesktop}px`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any

const [phone, tablet, desktop, largeDesktop] = breakpoints

breakpoints.phone = phone
breakpoints.tablet = tablet
breakpoints.desktop = desktop
breakpoints.largeDesktop = largeDesktop
