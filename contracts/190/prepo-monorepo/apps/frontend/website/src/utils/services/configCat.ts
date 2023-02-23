/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as configcat from 'configcat-js-ssr'
import config from '../../lib/config'

const LOG_LEVEL_INFO = 3
const logger = configcat.createConsoleLogger(LOG_LEVEL_INFO)

const configCatClient = configcat.createClientWithAutoPoll(config.CONFIG_CAT_SDK_KEY, {
  // <-- This is the actual SDK Key for your Production environment
  pollIntervalSeconds: 15, // Between configCatClient JS to configCatDashboard UI
  ...(config.isProduction ? {} : { logger }),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getFeature = (featureName: string, userObject: any): Promise<any> =>
  configCatClient.getValueAsync(featureName, false, userObject)
