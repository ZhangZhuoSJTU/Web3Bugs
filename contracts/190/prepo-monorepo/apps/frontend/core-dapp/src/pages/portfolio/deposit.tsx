import { NextPage } from 'next'
import SEO from '../../components/SEO'
import DepositPage from '../../features/deposit/DepositPage'

const Deposit: NextPage = () => (
  <>
    <SEO
      title="Deposit | prePO"
      description="Explore your portfolio on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <DepositPage />
  </>
)

export default Deposit
