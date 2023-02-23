import { Button, Icon, media, spacingIncrement, Switch } from 'prepo-ui'
import { getShortAccount } from 'prepo-utils'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import { useRootStore } from '../../../context/RootStoreProvider'
import useResponsive from '../../../hooks/useResponsive'
import { Routes } from '../../../lib/routes'
import AddressAvatar from '../../delegate/AddressAvatar'

const AddressWrapper = styled.div`
  align-items: center;
  border: 1px solid ${({ theme }): string => theme.color.neutral6};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  display: flex;
  flex-wrap: nowrap;
  gap: ${spacingIncrement(12)};
  justify-content: space-between;
  padding: ${spacingIncrement(18)};
  a {
    padding-left: ${spacingIncrement(6)};
    padding-right: ${spacingIncrement(6)};
  }
`

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
  ${media.desktop`
    gap: ${spacingIncrement(10)};
  `}
`

const LabelWrapper = styled.div`
  align-items: stretch;
  display: flex;
  justify-content: space-between;
`

const Label = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral3};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(5)};
  line-height: ${spacingIncrement(16)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
    line-height: ${spacingIncrement(20)};
  `}
`

const Text = styled.div`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  width: ${spacingIncrement(70)};
  ${media.desktop`
    width: ${spacingIncrement(100)};
  `}
`

const Content: React.FC = observer(() => {
  const {
    uiStore: { disableMocks },
    delegateStore: { selectedDelegate: delegate },
  } = useRootStore()
  return delegate ? (
    <AddressWrapper>
      <AddressAvatar
        loading={!delegate.delegateAddress}
        address={delegate.delegateAddress}
        avatarUrl={delegate.avatar}
      />
      <Text>{getShortAccount(delegate.delegateAddress)}</Text>
      <Button size="sm" type="ghost" href={Routes.Delegate_Custom_Address} disabled={disableMocks}>
        <Trans>Change Delegate</Trans>
      </Button>
    </AddressWrapper>
  ) : (
    <Button type="primary" href={Routes.Delegate_Custom_Address} block disabled={disableMocks}>
      <Trans>Delegate to Custom Address</Trans>
    </Button>
  )
})

const StakeDelegate: React.FC = () => {
  const {
    stakeStore: { showDelegate, onDelegateShowChange },
  } = useRootStore()
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '20' : '16'
  return (
    <Wrapper>
      <LabelWrapper>
        <Label>
          <Trans>Delegate Voting Power</Trans>
          {/* TODO: add tooltip text */}
          {false && <Icon name="info" color="neutral5" width={size} height={size} />}
        </Label>
        <Switch
          checked={showDelegate}
          onChange={onDelegateShowChange}
          color="success"
          size="default"
        />
      </LabelWrapper>
      {showDelegate && <Content />}
    </Wrapper>
  )
}

export default observer(StakeDelegate)
