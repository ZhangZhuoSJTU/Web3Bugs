import { Trans } from '@lingui/macro'
import { Heading, Icon, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import useResponsive from '../../../hooks/useResponsive'

type Props = {
  connected?: boolean
  power?: number
  expanded: boolean
  setExpanded: (expanded: boolean) => void
}

const Wrapper = styled.div`
  display: flex;
  margin-bottom: ${spacingIncrement(20)};
  ${media.desktop`
    margin-bottom: ${spacingIncrement(29)};
  `}
`

const StyledHeading = styled(Heading)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(18)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
    line-height: ${spacingIncrement(30)};
  `}
`

const Power = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['3xl']};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  `}
`

const Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  margin-left: ${spacingIncrement(14)};
  position: relative;
  ${media.desktop`
    margin-left: ${spacingIncrement(22)};
  `}
`

const ExpandButton = styled.button<{ $flip: boolean }>`
  background: transparent;
  border: none;
  position: absolute;
  right: 0;
  top: ${spacingIncrement(6)};
  transform: ${({ $flip }): string => `rotate(${$flip ? '180' : '0'}deg)`};
  transition: transform 0.2s;
`

const TotalVotingPower: React.FC<Props> = ({ connected, power, expanded, setExpanded }) => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '68' : '42'

  return (
    <Wrapper>
      <Icon name="ppo-logo" width={size} height={size} />
      <Content>
        <StyledHeading type="h4">
          <Trans>Total Voting Power</Trans>
        </StyledHeading>
        <Power>{connected ? power?.toLocaleString() : '-'}</Power>
        {!isDesktop && (
          <ExpandButton onClick={(): void => setExpanded(!expanded)} $flip={expanded}>
            <Icon name="sort-down" width="18" height="10" color="neutral3" />
          </ExpandButton>
        )}
      </Content>
    </Wrapper>
  )
}

export default TotalVotingPower
