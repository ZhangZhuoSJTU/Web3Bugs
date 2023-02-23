import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentInitialProps,
  DocumentContext,
} from 'next/document'
import config from '../lib/config'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx)
    return initialProps
  }

  // Font opimsation while using google fonts: https://nextjs.org/docs/basic-features/font-optimization/
  // For Custom Fonts follow this guide: https://kirazhang.com/posts/nextjs-custom-fonts/
  render(): JSX.Element {
    return (
      <Html
        lang="en"
        className="font-euclidA text-primary selection:text-black bg-white selection:bg-prepo-light"
      >
        <Head>
          <link rel="preload" as="font" href="/fonts/EuclidCircularA/Medium.woff2" crossOrigin="" />
          <link
            rel="preload"
            as="font"
            href="/fonts/EuclidCircularA/SemiBold.woff2"
            crossOrigin=""
          />
          <link
            rel="preload"
            as="font"
            href="/fonts/EuclidCircularA/Regular.woff2"
            crossOrigin=""
          />
          <link rel="preload" as="font" href="/fonts/EuclidCircularA/Bold.woff2" crossOrigin="" />
          <link rel="canonical" href={config.SITE_URL} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
