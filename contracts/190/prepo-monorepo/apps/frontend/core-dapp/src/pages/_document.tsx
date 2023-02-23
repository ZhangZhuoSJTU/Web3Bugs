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

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
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

  render(): JSX.Element {
    return (
      <Html>
        <Head>
          <link rel="preload" href="/fonts/EuclidCircularA/Regular.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularA/Medium.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularA/SemiBold.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularA/Bold.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularB/Regular.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularB/Medium.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularB/SemiBold.ttf" as="font" crossOrigin="" />
          <link rel="preload" href="/fonts/EuclidCircularB/Bold.ttf" as="font" crossOrigin="" />
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
