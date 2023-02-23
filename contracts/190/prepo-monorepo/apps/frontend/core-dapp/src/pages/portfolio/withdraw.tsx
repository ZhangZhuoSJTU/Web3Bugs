import { NextPage } from 'next'
import SEO from '../../components/SEO'
import WithdrawPage from '../../features/withdraw/WithdrawPage'

const Withdraw: NextPage = () => (
  <>
    <SEO
      title="Withdraw | prePO"
      description="Explore your portfolio on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <WithdrawPage />
  </>
)

export default Withdraw
