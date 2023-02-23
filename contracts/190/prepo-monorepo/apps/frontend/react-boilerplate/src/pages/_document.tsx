import { RenderPageResult } from 'next/dist/shared/lib/utils'
import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentInitialProps,
  DocumentContext,
} from 'next/document'
import { ServerStyleSheet } from 'styled-components'
import config from '../lib/config'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    // More referrence on the SSR of styled components:
    // https://styled-components.com/docs/advanced#server-side-rendering
    // https://github.com/vercel/next.js/blob/master/examples/with-styled-components/pages/_document.js
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      ctx.renderPage = (): RenderPageResult | Promise<RenderPageResult> =>
        originalRenderPage({
          enhanceApp:
            (App) =>
            (props): React.ReactElement<{ sheet: ServerStyleSheet }> =>
              // eslint-disable-next-line react/jsx-props-no-spreading
              sheet.collectStyles(<App {...props} />),
        })
      const initialProps = await Document.getInitialProps(ctx)
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      }
    } finally {
      sheet.seal()
    }
  }

  // Font opimsation while using google fonts: https://nextjs.org/docs/basic-features/font-optimization/
  // For Custom Fonts follow this guide: https://kirazhang.com/posts/nextjs-custom-fonts/
  render(): JSX.Element {
    return (
      <Html>
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
          {/* TODO remove the 3 lines below if you don't use these google fonts in your dapp */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter&family=Open+Sans&display=swap"
            rel="stylesheet"
          />
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
