import { useState, createRef, FC, KeyboardEvent } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import clsx from 'clsx'
import Head from 'next/head'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Icon } from '../Icon'
import { subscribe } from '../../utils/mailchimp-subscribe'
import { EMAIL_REGEX, RECAPTCHA_SITE_ID } from '../../lib/constants'

export const HeroNewsletterSignup: FC = () => {
  const recaptchaRef = createRef<ReCAPTCHA>()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const onUserSubscribe = (): void => {
    setLoading(true)
    subscribe(email, recaptchaRef).finally(() => setLoading(false))
  }
  const disabled = !EMAIL_REGEX.test(email)
  return (
    <>
      {/* Must place ReCAPTCHA component where we want challenge to appear */}
      <Head>
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://www.gstatic.com" />
      </Head>
      <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_ID} size="invisible" />
      <div className="inline-flex py-2 px-[14px] w-full max-w-[350px] bg-white border-[0.61px] border-inputBorder focus-within:border-prepo focus-within:ring-1 focus-within:ring-prepo sm:max-w-[400px] md:max-w-[500px] lg:max-w-[627px]">
        <input
          type="email"
          autoComplete="email"
          placeholder="Enter your Email Address"
          className="grow pl-0 w-1 text-[11px] leading-none placeholder:text-primary border-none focus:border-none focus:outline-none focus:ring-0 sm:text-xs md:text-sm lg:text-lg"
          value={email}
          onChange={(e): void => setEmail(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>): void => {
            if (e.key === 'Enter') onUserSubscribe()
          }}
        />
        <IconButton
          aria-label="Sign up"
          onClick={onUserSubscribe}
          icon={loading ? 'spinner' : 'arrowRightRound'}
          className={clsx(
            disabled && 'opacity-50 pointer-events-none',
            loading && 'rounded-full animate-spin pointer-events-none',
            'w-7 h-7 bg-transparent transition-all sm:hidden'
          )}
          iconClass="w-full h-full"
        />
        <Button
          onClick={onUserSubscribe}
          className={clsx(
            disabled && 'opacity-50 pointer-events-none',
            loading && 'bg-secondary hover:bg-secondary pointer-events-none',
            'hidden py-2 px-4 text-[11px] leading-none whitespace-nowrap transition-all sm:inline-block sm:text-xs md:px-10 md:text-sm lg:h-14 lg:text-lg'
          )}
        >
          <div className="flex items-center">
            Stay Updated
            <div
              className={clsx(
                loading ? 'ml-2 w-[1em] opacity-100' : 'ml-0 w-0 opacity-0',
                'transition-all animate-spin pointer-events-none'
              )}
            >
              <Icon width="1em" height="1em" name="spinner" />
            </div>
          </div>
        </Button>
      </div>
    </>
  )
}
