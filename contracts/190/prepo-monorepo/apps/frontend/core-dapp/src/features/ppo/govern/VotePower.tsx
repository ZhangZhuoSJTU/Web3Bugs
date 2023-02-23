import { media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import TotalVotingPower from './TotalVotingPower'
import FromPower from './FromPower'
import FromDelegators from './FromDelegators'
import DelegatedTo from './DelegatedTo'
import { useRootStore } from '../../../context/RootStoreProvider'

const DEFAULT_VALUES = {
  delegateAddress: '',
  ppoPower: 0,
  delegatorsPower: 0,
  delegatorsCount: 0,
  totalPPOPower: 0,
}

export const Wrapper = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral6};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme }): string => theme.color.neutral3};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(12)};
  line-height: ${spacingIncrement(14)};
  max-width: ${spacingIncrement(480)};
  padding: ${spacingIncrement(16)} ${spacingIncrement(20)};
  width: 100%;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
    gap: ${spacingIncrement(18)};
    line-height: ${spacingIncrement(36)};
    padding: ${spacingIncrement(28)} ${spacingIncrement(30)} ${spacingIncrement(18)};
  `}
  > a {
    border: none;
    height: ${spacingIncrement(62)};
    justify-self: center;
    position: relative;
    width: 100%;
    ${media.desktop`
      height: ${spacingIncrement(78)};
    `}
  }
`

const VotePower: React.FC<{ expanded: boolean; setExpanded: (expanded: boolean) => void }> = ({
  expanded,
  setExpanded,
}) => {
  const {
    web3Store: { connected },
    delegateStore: { selectedDelegate },
  } = useRootStore()

  const { totalPPOPower, ppoPower, delegatorsCount, delegatorsPower } =
    selectedDelegate ?? DEFAULT_VALUES

  return (
    <Wrapper>
      <TotalVotingPower
        connected={connected}
        power={totalPPOPower}
        expanded={expanded}
        setExpanded={setExpanded}
      />
      {expanded && (
        <>
          <FromPower connected={connected} power={ppoPower} />
          <FromDelegators
            connected={connected}
            power={delegatorsPower}
            delegatorsCount={delegatorsCount}
          />
          <DelegatedTo />
        </>
      )}
    </Wrapper>
  )
}

export default observer(VotePower)
