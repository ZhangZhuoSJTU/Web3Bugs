import { GetServerSideProps, NextPage } from 'next'
import { Routes } from '../lib/routes'

const Index: NextPage = () => null

// eslint-disable-next-line require-await
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    permanent: true, // https://nextjs.org/learn/seo/crawling-and-indexing/status-codes
    destination: Routes.Trade,
  },
  props: {},
})

export default Index
