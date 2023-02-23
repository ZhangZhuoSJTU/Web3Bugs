import Head from 'next/head'
import config from '../lib/config'

const DEFAULT_TITLE = 'prePO'
const DEFAULT_DESCRIPTION = 'Pre‑IPO & Pre‑Token Exchange'
const TWITTER_USERNAME = 'prepo_io'

type Props = {
  title?: string
  description?: string
  ogImageUrl: string
  url?: string
  twitterUsername?: string
}

const SEO: React.FC<Props> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ogImageUrl,
  url,
  twitterUsername = TWITTER_USERNAME,
}) => (
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
    <meta name="robots" content="noindex,nofollow" />

    {/* Twitter */}
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content={title} />
    <meta property="twitter:description" content={description} />
    <meta property="twitter:image" content={`${config.HOST}${ogImageUrl}`} />
    <meta name="twitter:creator" content={`@${twitterUsername}`} />

    {/* Open Graph / Facebook */}
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:image:width" content="1500" />
    <meta property="og:image:height" content="786" />
    <meta property="og:site_name" content={title} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={url} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
  </Head>
)

export default SEO
