import { Button, media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled, { css } from 'styled-components'
import { useRef } from 'react'
import { InputRef } from 'antd'
import DelegateAlertValidation from '../DelegateAlertValidation'
import AddressAvatar from '../AddressAvatar'
import { MINIMUM_INPUT_LENGTH } from '../DelegateStore'
import Input from '../../../components/Input'
import { useRootStore } from '../../../context/RootStoreProvider'
import useResponsive from '../../../hooks/useResponsive'
import { getShortAccount } from '../../../utils/account-utils'
import ComingSoonTooltip from '../../../components/ComingSoonTooltip'

const labelStyles = css`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const AddressInput = styled(Input)`
  span {
    ${labelStyles};
  }
`

const ActionButton = styled(Button)`
  margin-top: ${spacingIncrement(16)};

  ${media.tablet`
    margin-top: ${spacingIncrement(32)};
  `}
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};

  ${media.tablet`
    gap: ${spacingIncrement(8)};
  `}
`

const Address = styled.p`
  margin: 0;
  ${labelStyles};
`

const DelegateCustomAddress: React.FC = () => {
  const {
    delegateStore: {
      customDelegate,
      setSelectedDelegate,
      ensInputValue,
      reset,
      onChangeEnsNameInput,
      alreadySelected,
    },
    uiStore: { disableMocks },
  } = useRootStore()
  const { isPhone, isDesktop } = useResponsive()
  const inputSize = isDesktop ? 'large' : 'middle'
  const isMatch =
    ensInputValue !== customDelegate?.delegateAddress && ensInputValue !== customDelegate?.ensName
  const loading = (!customDelegate?.profileFetched || isMatch) && Boolean(ensInputValue)
  const showAlert =
    customDelegate?.profileFetched && ensInputValue.length > MINIMUM_INPUT_LENGTH && !loading
  const showAddress = customDelegate?.ensName && customDelegate.delegateAddress && !loading
  const address = customDelegate?.delegateAddress ?? ''
  const inputRef = useRef<InputRef>(null)

  return (
    <div>
      <Container>
        <AddressInput
          primaryLabel="Enter Custom Address or ENS Name"
          placeholder="prepo.eth"
          autoFocus
          ref={inputRef}
          onClear={(): void => {
            inputRef.current?.focus()
            reset()
          }}
          size={inputSize}
          prefix={
            <AddressAvatar
              loading={loading}
              address={address}
              avatarUrl={customDelegate?.avatar}
              avatarDiameter={{ desktop: 40, mobile: 24 }}
            />
          }
          onChange={onChangeEnsNameInput}
          value={ensInputValue}
        />
        {showAddress && <Address>{isPhone ? getShortAccount(address, 'medium') : address}</Address>}
        {showAlert && <DelegateAlertValidation />}
      </Container>
      <ComingSoonTooltip>
        <ActionButton
          type="primary"
          disabled={!showAddress || alreadySelected || loading || disableMocks}
          block
          onClick={(): void => setSelectedDelegate(customDelegate)}
        >
          Delegate to Custom Address
        </ActionButton>
      </ComingSoonTooltip>
    </div>
  )
}

export default observer(DelegateCustomAddress)
