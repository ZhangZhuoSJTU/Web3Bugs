export const IS_BROWSER = Boolean(process.browser)

export const ONE_SECOND = 1000

export const PROJECT_NAME = 'website'

export const PRODUCTION_DOMAIN_EN = ''

export const DEFAULT_LANGUAGE = 'en-us'

export const APP_NAME = 'prePO'

export enum ROUTES {
  APP = 'https://app.prepo.io',
  BLOG = 'https://medium.com/prepo',
  DOCS = 'https://docs.prepo.io',
  JOBS = 'https://url.prepo.io/jobs',
  NEWSLETTER = 'https://url.prepo.io/newsletter-website',
  PRESALE_BLOG = 'https://url.prepo.io/blog-presale-website',
  PUBLIC_SALE_BLOG = 'https://medium.com/prepo/announcing-the-ppo-token-public-sale-6f672e23325a',
  TELEGRAM = 'https://t.me/prePO_News',
  GITHUB = 'https://github.com/prepo-io',
  SIMULATOR = 'https://simulator.prepo.io',
  TOKEN_SALE = 'https://sale.prepo.io/',
}

export const MAILCHIMP_URL =
  'https://prepo.us6.list-manage.com/subscribe/post?u=b8c56831dea49f16a5f4d0518&id=111d836609'

// https://stackoverflow.com/a/201378
export const EMAIL_REGEX =
  // eslint-disable-next-line no-control-regex
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

export const EMPTY_RECAPTCHA_SITE_ID = '__EMPTY_RECAPTCHA_SITE_ID'
export const RECAPTCHA_SITE_ID =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_ID || '6Ld2IqcdAAAAAEogBZJGEJ_3s0vpsuHJ4UK0aECw'
export const MAILCHIMP_SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_MAILCHIMP_SUBSCRIBE_URL || 'https://mailchimp-subscribe.prepo.workers.dev'

export const PANELBEAR_SITE_ID = 'EZSAi3UGpKr'
