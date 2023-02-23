import Head from 'next/head'
import config from '../lib/config'

const DEFAULT_TITLE = 'prePO | Pre-IPO & Pre-Token Trading Platform'
const DEFAULT_DESCRIPTION = 'The decentralized Pre-IPO & Pre-Token trading platform'
const DEFAULT_IMAGE_URL = '/prepo-og-image.png'
const { TWITTER_SITE, SITE_URL } = config

type Props = {
  title?: string
  description?: string
  ogImageUrl?: string
  ogPageUrl?: string
}

const SEO: React.FC<Props> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ogImageUrl = DEFAULT_IMAGE_URL,
  ogPageUrl = '/',
}) => {
  const urlImage = new URL(ogImageUrl, SITE_URL).href
  const urlPage = new URL(ogPageUrl, SITE_URL).href

  return (
    <Head>
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon.ico" />

      <meta name="msapplication-TileColor" content="#000000" />
      <meta name="theme-color" content="#000" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary" />
      <meta property="twitter:site" content={TWITTER_SITE} />
      <meta property="twitter:url" content={urlPage} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={urlImage} />

      {/* Open Graph / Facebook */}
      <meta property="og:image" content={urlImage} />
      <meta property="og:image:width" content="1500" />
      <meta property="og:image:height" content="786" />
      <meta property="og:site_name" content={title} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={urlPage} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </Head>
  )
}

export default SEO
