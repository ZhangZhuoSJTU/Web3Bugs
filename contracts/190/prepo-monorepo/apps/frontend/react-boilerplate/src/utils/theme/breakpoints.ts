export type Sizes = {
  desktop: number
  tablet: number
  phone: number
}

export const sizes: Sizes = {
  desktop: 1300,
  tablet: 768,
  phone: 576,
}

export const pixelSizes = {
  desktop: `${sizes.desktop}px`,
  tablet: `${sizes.tablet}px`,
  phone: `${sizes.phone}px`,
}
