/*
  Tunnel for feature flags.
  Note: We are not naming it "feature" or anything implicit so ad blockers doesn't block it
*/

import * as configCat from 'configcat-js-ssr'
import { NextApiRequest, NextApiResponse } from 'next'
import config from '../../lib/config'

const LOG_LEVEL_INFO = 3
const logger = configCat.createConsoleLogger(LOG_LEVEL_INFO)

const configCatClient = configCat.createClientWithAutoPoll(config.CONFIG_CAT_SDK_KEY, {
  pollIntervalSeconds: 15, // Between configCatClient JS to configCatDashboard UI
  ...(config.isProduction ? {} : { logger }),
})

const application = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    const { featureName, userAddress } = req.body
    const user = {
      identifier: userAddress,
    }

    const response = await configCatClient.getValueAsync(featureName, false, user)
    res.status(200).send(response)
  } catch (e) {
    res.status(400).json({ status: 'invalid request' })
  } finally {
    res.end()
  }
}

export default application
