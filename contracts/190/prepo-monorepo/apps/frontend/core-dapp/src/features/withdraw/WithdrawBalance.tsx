import { formatNumber } from 'prepo-utils'
import { LabelWrapper } from '../../components/Input'

const WithdrawBalance: React.FC<{ balance: number }> = ({ balance }) => (
  <LabelWrapper weight="medium">
    Withdrawable Balance:{' '}
    <LabelWrapper weight="semiBold">{formatNumber(balance, { usd: true })}</LabelWrapper>
  </LabelWrapper>
)

export default WithdrawBalance
