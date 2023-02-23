import { NextApiRequest, NextApiResponse } from 'next'

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    await fetch('https://api.panelbear.com/api/_/events', {
      method: 'POST',
      body: req.body,
    })
    res.status(200)
  } catch (e) {
    res.status(400).json({ status: 'invalid request' })
  } finally {
    res.end()
  }
}

export default handler
