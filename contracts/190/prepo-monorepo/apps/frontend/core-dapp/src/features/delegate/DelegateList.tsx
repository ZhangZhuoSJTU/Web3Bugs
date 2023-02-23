import { observer } from 'mobx-react-lite'
import styled, { css } from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'
import DelegateCard from './DelegateCard'
import { useRootStore } from '../../context/RootStoreProvider'

const GAP = {
  desktop: 32,
  mobile: 0,
}

const scrollBarStylesMobile = css`
  /* Width */
  ::-webkit-scrollbar {
    width: ${spacingIncrement(4)};
    height: ${spacingIncrement(4)};
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }): string => theme.color.primary};
    border-radius: 0;
    height: ${spacingIncrement(6)};
  }
`
const scrollBarStylesDesktop = css`
  /* Width */
  ::-webkit-scrollbar:vertical {
    width: ${spacingIncrement(4)};
  }

  /* Track */
  ::-webkit-scrollbar-track:vertical {
    border-radius: 10px;
    box-shadow: inset 0 0 5px grey;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb:vertical {
    background: ${({ theme }): string => theme.color.primary};
    border-radius: 0;
    height: ${spacingIncrement(6)};
  }
`

const Wrapper = styled.div`
  ${scrollBarStylesMobile};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  display: grid;
  grid-gap: ${spacingIncrement(GAP.mobile)};
  grid-template-columns: 1fr;
  height: 40vh;
  margin: ${spacingIncrement(18)} 0;
  overflow: overlay;

  ${media.desktop`
    /* ${scrollBarStylesDesktop}; */
    padding: 0 ${spacingIncrement(24)};
    border: none;
    height: 55vh;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: ${spacingIncrement(0)} ${spacingIncrement(GAP.desktop)};
  `}
`

const DelegateList: React.FC = () => {
  const { delegateStore } = useRootStore()
  return (
    <Wrapper>
      {delegateStore.delegatesList.map(
        (
          delegate // TODO: change to delegate address after SC integration
        ) => (
          <DelegateCard key={delegate.delegateAddress} delegateEntity={delegate} />
        )
      )}
    </Wrapper>
  )
}

export default observer(DelegateList)
