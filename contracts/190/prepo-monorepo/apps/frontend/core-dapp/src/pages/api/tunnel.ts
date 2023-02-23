import { withSentry, captureException } from '@sentry/nextjs'
import { NextApiRequest, NextApiResponse } from 'next'
import url from 'url'

// Change host appropriately if you run your own Sentry instance.
const sentryHost = 'sentry.io'

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    const envelope = req.body
    const pieces = envelope.split('\n')

    const header = JSON.parse(pieces[0])

    const { host, path } = url.parse(header.dsn)
    if (!host?.includes(sentryHost)) {
      throw new Error(`invalid host: ${host}`)
    }

    const projectId = path?.startsWith('/') ? path.substring(1) : path ?? ''

    const sentryUrl = `https://${sentryHost}/api/${projectId}/envelope/`

    const postRequestToSentry = await fetch(sentryUrl, {
      method: 'POST',
      body: envelope,
    })
    const response = await postRequestToSentry.json()
    res.status(200).json(response)
  } catch (e) {
    captureException(e)
    res.status(400).json({ status: 'invalid request' })
  } finally {
    res.end()
  }
}

export default withSentry(handler)
