import { Button } from 'antd'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { useRootStore } from '../context/RootStoreProvider'
import { spacingIncrement } from '../utils/theme/utils'

const Wrapper = styled(Button)`
  margin-left: ${spacingIncrement(32)};
`

const ToggleTheme: React.FC = () => {
  const { uiStore } = useRootStore()
  const newTheme = uiStore.selectedTheme === 'light' ? 'dark' : 'light'
  return (
    <Wrapper
      type="primary"
      size="large"
      onClick={(): void => {
        uiStore.setTheme(newTheme)
      }}
    >
      Toggle Theme
    </Wrapper>
  )
}

export default observer(ToggleTheme)
