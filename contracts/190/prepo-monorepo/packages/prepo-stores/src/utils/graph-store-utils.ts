import { DocumentNode } from 'graphql'

export const getQueryString = (gqlQuery: DocumentNode | string): string =>
  typeof gqlQuery === 'string' ? gqlQuery : gqlQuery.loc?.source.body ?? ''
