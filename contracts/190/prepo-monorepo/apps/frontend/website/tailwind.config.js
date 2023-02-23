/* eslint-disable global-require */
// https://tailwindcss.com/docs/configuration#scaffolding-the-entire-default-configuration
// pro tips : see the "scaffolding the entire default configuration" section

// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultTheme = require('tailwindcss/defaultTheme')

const CAROUSEL_ANIM_DURATION = '0.3s'

module.exports = {
  content: ['src/pages/**/*.{js,ts,jsx,tsx}', 'src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // THEME OVERRIDES
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#fff',
      black: '#000',
      prepo: {
        // icon buttons background
        light: '#E5E5FB',
        DEFAULT: '#6264D9',
        accent: '#454699',
      },
      background: {
        DEFAULT: '#fff',
        footer: '#F5F7FA',
      },

      // used for borders of the newsletter signup
      inputBorder: '#F2F2FF',
      // primary text
      primary: '#6A7271',
      // used everywhere in footer, with or without transparency
      secondary: '#233460',
      // titles
      title: '#191B1F',
      // footer separator #747F9B with 9% opacity
      separator: 'rgba(116, 127, 155, 0.09)',
    },
    fontFamily: {
      euclidA: ['"Euclid Circular A"', '"Open Sans"'],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    screens: {
      '2xs': '320px',
      xs: '400px',
      ...defaultTheme.screens,
    },

    // THEME EXTENDS
    extend: {
      boxShadow: {
        'prepo-3': '0 0 3px rgba(98, 100, 217, 0.13)',
        'prepo-4': '0 0 4px rgba(98, 100, 217, 0.13)',
      },
      animation: {
        'maintain-svg': 'super-minimum-scale 1s infinite',
        'bubble-popped': 'bubble-popped 0.5s ease-in',
        'opaque-for-1s': 'opaque 1s ease-in 0s 1',
        fadein: 'fadein 0.5s ease-in',
        'fadein-long': 'fadein 0.7s cubic-bezier(0.11, 0, 0.5, 0)',
        fadeinltr: 'fadeinltr 0.5s ease-in',
        'fadeinltr-long': 'fadeinltr 0.7s cubic-bezier(0.11, 0, 0.5, 0)',
        fadeinup: 'fadeinup 0.5s ease-in',
        'fadeinup-long': 'fadeinup 0.7s cubic-bezier(0.11, 0, 0.5, 0)',
        slideup: 'slideup 0.5s ease-in',
        'slideup-long': 'slideup 0.7s cubic-bezier(0.11, 0, 0.5, 0)',
        fadeout: 'fadeout 0.5s ease-in',
        'curved-carousel-fadein': `fadein ${CAROUSEL_ANIM_DURATION} ease-in`,
        'curved-carousel-fadeout': `fadeout ${CAROUSEL_ANIM_DURATION} ease-in`,
        'curved-carousel-out-prev': `curved-carousel-out-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-left-prev': `curved-carousel-left-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-center-prev': `curved-carousel-center-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-right-prev': `curved-carousel-right-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-out-next': `curved-carousel-out-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-left-next': `curved-carousel-left-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-center-next': `curved-carousel-center-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-right-next': `curved-carousel-right-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-out-prev': `curved-carousel-icon-out-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-left-prev': `curved-carousel-icon-left-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-center-prev': `curved-carousel-icon-center-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-right-prev': `curved-carousel-icon-right-prev ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-out-next': `curved-carousel-icon-out-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-left-next': `curved-carousel-icon-left-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-center-next': `curved-carousel-icon-center-next ${CAROUSEL_ANIM_DURATION} ease-out`,
        'curved-carousel-icon-right-next': `curved-carousel-icon-right-next ${CAROUSEL_ANIM_DURATION} ease-out`,
      },
      backgroundImage: {
        bubble: 'radial-gradient(50% 50% at 50% 50%, #6264D9 0%, #9C93FF 0.01%, #6264D9 100%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        // only used to maintain svg image on Safari
        'super-minimum-scale': {
          '75%, 100%': {
            transform: 'scale(0.999)',
          },
        },
        opaque: {
          '0%, 100%': { opacity: '100%' },
        },
        fadeinltr: {
          '0%': { opacity: 0, transform: 'translateX(-100%)' },
          '100%': { opacity: '100%', transform: 'translateX(0)' },
        },
        fadein: {
          '0%': { opacity: 0 },
          '100%': { opacity: '100%' },
        },
        fadeinup: {
          '0%': { opacity: 0, transform: 'translateY(20%)' },
          '100%': { opacity: '100%', transform: 'translateY(0)' },
        },
        fadeout: {
          '0%': { opacity: '100%' },
          '100%': { opacity: 0 },
        },
        slideup: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY()' },
        },
        'curved-carousel-out-prev': {
          '0%': { transform: 'rotate(45deg)' },
          '100%': { transform: 'rotate(90deg)' },
        },
        'curved-carousel-left-prev': {
          '0%': { transform: 'rotate(-90deg)' },
          '100%': { transform: 'rotate(-45deg)' },
        },
        'curved-carousel-center-prev': {
          '0%': { transform: 'rotate(-45deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'curved-carousel-right-prev': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(45deg)' },
        },
        'curved-carousel-out-next': {
          '0%': { transform: 'rotate(-45deg)' },
          '100%': { transform: 'rotate(-90deg)' },
        },
        'curved-carousel-left-next': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-45deg)' },
        },
        'curved-carousel-center-next': {
          '0%': { transform: 'rotate(45deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'curved-carousel-right-next': {
          '0%': { color: 'red', transform: 'rotate(90deg)' },
          '100%': { color: 'red', transform: 'rotate(45deg)' },
        },
        'curved-carousel-icon-out-prev': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-45deg)' },
        },
        'curved-carousel-icon-left-prev': {
          '0%': { transform: 'rotate(45deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'curved-carousel-icon-center-prev': {
          '0%': {
            color: '#6264D9',
            background: 'rgba(229, 229, 251, 0.25)',
            transform: 'rotate(0deg)',
          },
          '100%': { color: 'white', background: '#6264D9', transform: 'rotate(-45deg)' },
        },
        'curved-carousel-icon-right-prev': {
          '0%': { transform: 'rotate(45deg)', color: 'white', 'background-color': '#6264D9' },
          '100%': {
            transform: 'rotate(0deg)',
            color: '#6264D9',
            'background-color': 'rgba(229, 229, 251, 0.25)',
          },
        },
        'curved-carousel-icon-out-next': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(45deg)' },
        },
        'curved-carousel-icon-left-next': {
          '0%': { transform: 'rotate(-45deg)', color: 'white', 'background-color': '#6264D9' },
          '100%': {
            transform: 'rotate(0deg)',
            color: '#6264D9',
            'background-color': 'rgba(229, 229, 251, 0.25)',
          },
        },
        'curved-carousel-icon-center-next': {
          '0%': {
            transform: 'rotate(0deg)',
            color: '#6264D9',
            background: 'rgba(229, 229, 251, 0.25)',
          },
          '100%': { transform: 'rotate(45deg)', color: 'white', background: '#6264D9' },
        },
        'curved-carousel-icon-right-next': {
          '0%': { transform: 'rotate(-90deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'bubble-popped': {
          '0%': { opacity: 0, transform: 'scale(0)' },
          '30%': { opacity: 0.5, transform: 'scale(0.3)' },
          '70%': { opacity: 1, transform: 'scale(1.1)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms'), require('tailwind-scrollbar-hide')],
}
