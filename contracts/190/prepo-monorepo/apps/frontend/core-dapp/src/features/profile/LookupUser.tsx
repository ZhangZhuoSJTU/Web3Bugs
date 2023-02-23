import { Flex, Input, InputContainer, LabelWrapper, media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { ZERO_ADDRESS } from 'prepo-constants'
import { t } from '@lingui/macro'
import { CUSTOM_STYLE } from './TotalEarned'
import ButtonLink from '../ppo/ButtonLink'
import { Routes } from '../../lib/routes'
import { useRootStore } from '../../context/RootStoreProvider'
import AddressAvatar from '../delegate/AddressAvatar'
import { getShortAccount } from '../../utils/account-utils'

const PLACEHOLDER = getShortAccount(ZERO_ADDRESS) ?? ''

const InputWrapper = styled.div`
  flex: 3;
  span {
    font-size: ${({ theme }): string => theme.fontSize.sm};
    margin-bottom: ${spacingIncrement(5)};
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
    `}
  }
  &&&& {
    *,
    *:focus-within {
      border: none;
      box-shadow: none;
      margin-bottom: 0;
      padding: 0 ${spacingIncrement(4)};
    }
    input {
      padding: 0 ${spacingIncrement(4)};
      ::placeholder {
        color: ${({ theme }): string => theme.color.neutral5};
        font-weight: ${({ theme }): number => theme.fontWeight.medium};
      }
    }
  }
`

const StyledInput = styled(Input)`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  ${LabelWrapper} {
    height: 24px;
  }
  ${InputContainer} {
    display: flex;
    height: 29px;
    padding: 0;
    span {
      height: 29px;
    }
  }
`

const LookupUser: React.FC = () => {
  const {
    delegateStore: { loading, customDelegate, onChangeEnsNameInput, ensInputValue },
  } = useRootStore()
  const disabled = loading || !customDelegate?.delegateAddress

  return (
    <Flex
      border="1px solid"
      borderColor="neutral7"
      borderRadius={20}
      justifyContent="space-between"
      py={11}
      pl={23}
      pr={28}
      gap={{ phone: 5, desktop: 15 }}
    >
      <InputWrapper>
        <StyledInput
          prefix={
            <AddressAvatar
              loading={loading}
              address={customDelegate?.delegateAddress}
              avatarUrl={customDelegate?.avatar}
              avatarDiameter={{ desktop: 20, mobile: 20 }}
            />
          }
          label={t`Lookup User`}
          placeholder={PLACEHOLDER}
          value={ensInputValue}
          onChange={onChangeEnsNameInput}
        />
      </InputWrapper>
      <ButtonLink
        disabled={disabled}
        customStyles={CUSTOM_STYLE}
        title={t`View Profile`}
        href={`${Routes.Profile}?search=${ensInputValue}`}
      />
    </Flex>
  )
}

export default observer(LookupUser)
