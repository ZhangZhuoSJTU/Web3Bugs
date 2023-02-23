import { media, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Trans } from '@lingui/macro'
import Participate from './Participate'
import VotePower from './VotePower'
import DelegatedTo from './DelegatedTo'
import useResponsive from '../../../hooks/useResponsive'
import PageTitle from '../PageTitle'
import PageDescription from '../PageDescription'

const Wrapper = styled.div`
  margin: auto;
  max-width: ${spacingIncrement(960)};
`

const Content = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(32)};
  margin: 0 auto;
  margin-top: ${spacingIncrement(25)};
  ${media.desktop`
    align-items: flex-start;
    flex-direction: row;
    gap: ${spacingIncrement(24)};
    margin-top: ${spacingIncrement(47)};
  `}
`

export const WithBorder = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral6};
  border-radius: ${spacingIncrement(5)};
  max-width: ${spacingIncrement(480)};
  padding: ${spacingIncrement(16)} ${spacingIncrement(20)};
  width: 100%;
`

const GovernPage: React.FC = () => {
  const [expanded, setExpanded] = useState(false)
  const { isDesktop } = useResponsive()
  const show = isDesktop || expanded

  return (
    <Wrapper>
      <PageTitle>
        <Trans>Govern PPO</Trans>
      </PageTitle>
      {isDesktop && (
        <PageDescription>
          <Trans>Earn PPO by participating in governance</Trans>
        </PageDescription>
      )}
      <Content>
        <VotePower expanded={show} setExpanded={setExpanded} />
        <Participate />
        {!show && (
          <WithBorder>
            <DelegatedTo />
          </WithBorder>
        )}
      </Content>
    </Wrapper>
  )
}

export default observer(GovernPage)
