import { RefObject } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import confetti from 'canvas-confetti'
import { toast } from 'react-toastify'
import {
  EMAIL_REGEX,
  EMPTY_RECAPTCHA_SITE_ID,
  MAILCHIMP_SUBSCRIBE_URL,
  RECAPTCHA_SITE_ID,
} from '../lib/constants'

type Subscribe = (email: string, recaptchaRef: RefObject<ReCAPTCHA>) => Promise<boolean>

const subscribe: Subscribe = async (email: string, recaptchaRef: RefObject<ReCAPTCHA>) => {
  try {
    if (!EMAIL_REGEX.test(email)) throw Error('Invalid email')
    if (RECAPTCHA_SITE_ID === EMPTY_RECAPTCHA_SITE_ID)
      throw new Error('No recaptcha site id provided')
    if (!recaptchaRef || !recaptchaRef.current) throw Error('Invalid ReCAPTCHA ref')

    // Get recaptcha token
    recaptchaRef.current.reset()
    const token = await recaptchaRef.current.executeAsync()

    // Subscribe
    const payload = {
      email,
      token,
    }
    const res = await fetch(MAILCHIMP_SUBSCRIBE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(payload),
    })

    // Check response
    const message = await res.text()
    if (message && message.includes('already a list member')) {
      toast('Already subscribed', { type: 'info' })
      return true
    }
    if (res.status !== 200) throw Error(message)

    // Celebrate 🎉
    toast('Subscribed 🥳', { style: { textAlign: 'center' }, position: toast.POSITION.TOP_CENTER })
    confetti({
      particleCount: 1000,
      spread: 90,
      startVelocity: 100,
      ticks: 750,
    })
    return true
  } catch (error) {
    if (error instanceof Error) toast(error.message, { type: toast.TYPE.ERROR })
    else toast('Unknown error', { type: toast.TYPE.ERROR })
    return false
  }
}

export { subscribe }
