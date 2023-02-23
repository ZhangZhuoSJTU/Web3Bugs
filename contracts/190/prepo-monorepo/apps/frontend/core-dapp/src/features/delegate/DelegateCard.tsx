import { centered, Icon, media, spacingIncrement, Subtitle } from 'prepo-ui'
import styled from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import { observer } from 'mobx-react-lite'
import AddressAvatar, { AvatarDiameter } from './AddressAvatar'
import { getShortAccount } from '../../utils/account-utils'
import { noSelect } from '../../styles/noSelect.style'
import { DelegateEntity } from '../../stores/entities/DelegateEntity'
import { useRootStore } from '../../context/RootStoreProvider'
import { numberFormatter } from '../../utils/numberFormatter'

const { withCommas } = numberFormatter

type Props = {
  delegateEntity: DelegateEntity
}

const Wrapper = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.neutral8};
  padding: ${spacingIncrement(10)} ${spacingIncrement(12)};

  &:last-child {
    border: none;
  }

  ${media.desktop`
    padding: ${spacingIncrement(16)} 0;
    border: none;
  `}
`

const Container = styled.div<{ selected: boolean }>`
  ${noSelect};
  align-items: center;
  align-self: center;
  border: 1px solid
    ${({ selected, theme }): string => (selected ? theme.color.primary : 'transparent')};
  border-radius: ${spacingIncrement(5)};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  justify-self: center;
  padding: ${spacingIncrement(11)} ${spacingIncrement(8)};
  position: relative;
  width: 100%;

  ${media.desktop`
    border: 1px solid ${({ theme }): string => theme.color.neutral8};
    min-width: ${spacingIncrement(360)};
  `}
`

const SelectedIcon = styled(Icon)<{ selected: boolean }>`
  ${centered};
  background-color: ${({ theme }): string => theme.color.primary};
  border-radius: 50%;
  height: ${spacingIncrement(14)};
  opacity: ${({ selected }): string => (selected ? '1' : '0')};
  padding: ${spacingIncrement(4)};
  position: absolute;
  right: -${spacingIncrement(8)};
  top: -${spacingIncrement(8)};
  transition: all 0.1s ease-out;
  width: ${spacingIncrement(14)};

  ${media.desktop`
    height: ${spacingIncrement(16)};
    width: ${spacingIncrement(16)};
  `}
`

const Section = styled.div`
  display: flex;
`

const Metadata = styled.div`
  margin-left: ${spacingIncrement(12)};
`

const MetadataSection = styled.div`
  display: flex;
`

const WalletAddressOrName = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const PrecogTag = styled.div`
  ${centered};
  background-color: ${({ theme }): string => theme.color.accent1};
  border-radius: ${spacingIncrement(2.5)};
  color: ${({ theme }): string => theme.color.primary};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(15)};
  margin-left: ${spacingIncrement(5)};
  padding: ${spacingIncrement(4)} ${spacingIncrement(10)};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
    line-height: ${spacingIncrement(20)};
  `}
`

const VotingPower = styled(Subtitle)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const IconWrapper = styled.div`
  background-color: ${({ theme }): string => theme.color.accent1};
  border-radius: ${spacingIncrement(5)};
  padding: ${spacingIncrement(7)};

  > div {
    align-items: center;
    display: flex;
    justify-content: center;
  }
`

const avatarDiameter: AvatarDiameter = {
  desktop: 60,
  mobile: 48,
}

const DelegateCard: React.FC<Props> = ({ delegateEntity }) => {
  const { delegateStore } = useRootStore()
  const selected =
    delegateEntity.profileFetched &&
    delegateEntity.delegateAddress === delegateStore.selectedDelegate?.delegateAddress
  const onSelect = (): void => {
    delegateStore.setSelectedDelegate(delegateEntity)
  }

  const ppoPowerFormat = withCommas(delegateEntity.delegatorsPower)
  const delegatorsFormat = withCommas(delegateEntity.delegatorsCount)
  const votingPowerFormat = withCommas(delegateEntity.ppoPower)
  const votingPowerTooltip = `${ppoPowerFormat} from PPO Power + ${delegatorsFormat} from Delegators`

  return (
    <Wrapper>
      <Container selected={selected} onClick={onSelect}>
        <SelectedIcon name="check" color="accent2" selected={selected} />
        <Section>
          <AddressAvatar
            loading={!delegateEntity.profileFetched}
            avatarDiameter={avatarDiameter}
            avatarUrl={delegateEntity.avatar}
            address={delegateEntity.delegateAddress}
          />
          <Metadata>
            <MetadataSection>
              {!delegateEntity.profileFetched ? (
                <Skeleton width={80} height={20} />
              ) : (
                <WalletAddressOrName>
                  {delegateEntity.ensName ??
                    getShortAccount(delegateEntity.delegateAddress, 'small')}
                </WalletAddressOrName>
              )}
              <PrecogTag>Precog</PrecogTag>
            </MetadataSection>
            <MetadataSection>
              {!delegateEntity ? (
                <Skeleton width={180} height={20} />
              ) : (
                <VotingPower tooltip={votingPowerTooltip}>
                  Voting Power: {votingPowerFormat}
                </VotingPower>
              )}
            </MetadataSection>
          </Metadata>
        </Section>
        <IconWrapper>
          <Icon name="profile" color="neutral5" />
        </IconWrapper>
      </Container>
    </Wrapper>
  )
}

export default observer(DelegateCard)
