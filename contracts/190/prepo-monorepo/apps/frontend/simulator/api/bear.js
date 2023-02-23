import fetch from 'node-fetch'

const handler = async (req, res) => {
  try {
    if (req.url === '/api/bear?/api/_/events' || req.url === '/api/bear?%2Fapi%2F_%2Fevents') {
      await fetch('https://api.panelbear.com/api/_/events', {
        method: 'POST',
        body: req.body,
      })
      res.status(200)
      return
    }
    res.status(400).json({ status: 'wrong route' })
  } catch (e) {
    res.status(400).json({ status: 'invalid request' })
  } finally {
    res.end()
  }
}

export default handler
