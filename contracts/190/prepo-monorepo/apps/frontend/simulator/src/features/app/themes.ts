import { DefaultTheme } from 'styled-components'

export type Theme = 'standard' | 'pregen'

type Themes = {
  [theme in Theme]: DefaultTheme
}

// General
const initialUnit = 0.5

export const spacingIncrement = (multiplier: number): string => `${multiplier * initialUnit}rem`

const themes: Themes = {
  standard: {
    name: 'standard',
    colors: {
      primary: '#6264D8',
      primaryLight: '#E5E5FF',
      subtitle: '#707070',
      background: '#F3F3F3',
      foreground: '#FFFFFF',
      accent: '#A0A0A0',
      accentLight: '#DADADA',
      buttonLight: '#EBEBEB',
      profit: '#0E992F',
      profitBright: '#00AF2A',
      loss: '#D5141B',
      textPrimary: '#0F0F0F',
      textSecondary: '#FFFFFF',
      tooltipBackground: '#484848',
    },
    fontFamily: 'Nunito, Raleway, sans-serif',
    fontSize: {
      xsm: '0.875rem', // 14px
      sm: '0.9375rem', // 15px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      lgx: '1.25rem', // 20px
      xl: '1.75rem', // 24px
      xxl: '1.875rem',
      xxxl: '1.5rem',
      xxxxl: '2.5rem',
      xxxxxl: '3rem',
    },
  },
  pregen: {
    name: 'pregen',
    colors: {
      primary: '#6264D8',
      primaryLight: '#E5E5FF',
      subtitle: '#707070',
      background: 'lime',
      foreground: '#FFFFFF',
      accent: '#A0A0A0',
      accentLight: '#DADADA',
      buttonLight: '#EBEBEB',
      profit: '#0E992F',
      profitBright: '#00AF2A',
      loss: '#D5141B',
      textPrimary: '#0F0F0F',
      textSecondary: '#FFFFFF',
      tooltipBackground: '#484848',
    },
    fontFamily: 'Comic Sans MS, Comic Sans, Chilanka, cursive',
    fontSize: {
      xsm: '0.875rem',
      sm: '0.9375rem', // 15px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      lgx: '1.25rem', // 20px
      xl: '1.75rem', // 28px
      xxl: '1.875rem',
      xxxl: '1.5rem',
      xxxxl: '2.5rem',
      xxxxxl: '3rem',
    },
  },
}

export type Sizes = {
  lg: number
  md: number
}

export const sizes: Sizes = {
  lg: 992,
  md: 768,
}

export default themes
