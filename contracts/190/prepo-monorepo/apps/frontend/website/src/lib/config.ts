const config = {
  ENVIRONMENT: process.env.ENVIRONMENT ?? 'dev',
  ROUNDED_DECIMALS: 4,
  CONFIG_CAT_SDK_KEY: 'xYjZCIkJi0eABaTu6QgigA/c-u2N7zb0EGnXQhvsjdsnQ',
  SITE_URL: process.env.SITE_URL ?? 'https://prepo.io/',
  TWITTER_SITE: '@prepo_io',
}

const appConfig = {
  isProduction: config.ENVIRONMENT === 'production',
}

export default { ...config, ...appConfig }
