/* eslint-disable no-console */
import NextErrorComponent, { ErrorProps as NextErrorProps } from 'next/error'

import * as Sentry from '@sentry/nextjs'

import { NextPageContext } from 'next'

export type ErrorPageProps = {
  err: Error
  statusCode: number
  isReadyToRender: boolean
  children?: React.ReactElement
}

export type ErrorProps = {
  isReadyToRender: boolean
} & NextErrorProps

const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

const ErrorPage = (props: ErrorPageProps): JSX.Element => {
  const { statusCode, isReadyToRender, err, children = null } = props

  if (isProduction) {
    console.warn(
      'ErrorPage - Unexpected error caught, it was captured and sent to Sentry. Error details:'
    )
    console.error(err)
  }

  if (!isReadyToRender && err) {
    Sentry.captureException(err)
  }

  return children ?? <NextErrorComponent statusCode={statusCode} />
}

ErrorPage.getInitialProps = async (props: NextPageContext): Promise<ErrorProps> => {
  const { res, err, asPath } = props

  const errorInitialProps: ErrorProps = (await NextErrorComponent.getInitialProps({
    res,
    err,
  } as NextPageContext)) as ErrorProps

  errorInitialProps.isReadyToRender = true

  if (res?.statusCode === 404) {
    return { statusCode: 404, isReadyToRender: true }
  }

  if (err && isProduction) {
    Sentry.captureException(err)
    await Sentry.flush(2000)
    return errorInitialProps
  }

  if (isProduction) {
    Sentry.captureException(new Error(`_error.js getInitialProps missing data at path: ${asPath}`))
  }
  await Sentry.flush(2000)

  return errorInitialProps
}

export default ErrorPage
