import { AutoCompleteProps } from 'antd'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import Search from './Search'
import { useRootStore } from '../context/RootStoreProvider'

const MarketSearch: React.FC<AutoCompleteProps & { placeholder?: string }> = ({
  placeholder,
  ...props
}) => {
  const { marketStore } = useRootStore()
  const router = useRouter()
  const { searchQuery } = marketStore
  const { searchKeyWords } = marketStore
  return (
    <Search
      autoCompleteOptions={searchKeyWords}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
      onSelect={(market: string): Promise<boolean> =>
        router.push(`/markets/${market.toLowerCase()}`)
      }
      placeholder={placeholder ?? 'Search for Markets'}
      value={searchQuery}
    />
  )
}
export default observer(MarketSearch)
