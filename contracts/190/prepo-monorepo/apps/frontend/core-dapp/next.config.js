/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-var-requires */
const root = process.cwd()
const { withSentryConfig } = require('@sentry/nextjs')
const path = require('path')
const withTM = require('next-transpile-modules')([
  'prepo-constants',
  'prepo-utils',
  'prepo-ui',
  'prepo-stores',
])
const { locales, sourceLocale } = require('./lingui.config.js')

const rewrites = async () => {
  return [
    {
      source: '/bear.js',
      destination: 'https://cdn.panelbear.com/analytics.js',
    },
  ]
}

const nextConfig = {
  rewrites,
  experimental: { esmExternals: 'loose' },
  i18n: {
    locales,
    defaultLocale: sourceLocale,
  },
  compiler: {
    // ssr and displayName are configured by default
    styledComponents: true,
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.po/,
      use: ['@lingui/loader'],
    })
    config.resolve.alias = {
      ...config.resolve.alias,
      'styled-components': path.resolve(root, '../../../node_modules', 'styled-components'),

      // removes the problem described here without having to link manually on dev machine
      // https://reactjs.org/warnings/invalid-hook-call-warning.html#duplicate-react
      react: path.resolve(root, '../../../node_modules', 'react'),
    }

    config.resolve.fallback = { fs: false }

    // Important: return the modified config
    return config
  },
}

// For all available options, see:
// https://github.com/getsentry/sentry-webpack-plugin#options.
const sentryWebpackPluginOptions = {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
}

module.exports = withTM(withSentryConfig(nextConfig, sentryWebpackPluginOptions))
