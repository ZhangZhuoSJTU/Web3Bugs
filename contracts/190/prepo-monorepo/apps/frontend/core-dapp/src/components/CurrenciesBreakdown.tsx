import { observer } from 'mobx-react-lite'
import { formatNumber } from 'prepo-utils'
import ListCard from './ListCard'
import { useRootStore } from '../context/RootStoreProvider'

const CurrenciesBreakdown: React.FC = () => {
  const { currenciesStore } = useRootStore()
  const { selectedCurrencies } = currenciesStore

  if (selectedCurrencies.length <= 1) return null

  return (
    <ListCard
      label="Amount Breakdown"
      itemName="Token"
      data={selectedCurrencies.map(({ name, balance, value, iconName }) => ({
        iconName,
        label: name,
        secondaryLabel: formatNumber(value || 0, { usd: true }),
        description: `${balance || 0} ${name}`,
      }))}
    />
  )
}

export default observer(CurrenciesBreakdown)
