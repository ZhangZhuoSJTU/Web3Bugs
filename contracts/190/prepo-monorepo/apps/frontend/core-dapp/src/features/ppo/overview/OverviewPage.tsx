import { observer } from 'mobx-react'
import { Icon } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import { ButtonGrid } from '../ButtonGrid'
import useResponsive from '../../../hooks/useResponsive'
import PageTitle from '../PageTitle'
import PageDescription from '../PageDescription'
import usePpoNavigation from '../usePpoNavigation'
import { LearnMore } from '../stake/StakeWarningMessages'

const OverviewPage: React.FC = () => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '48' : '31'
  const ppoItems = usePpoNavigation()

  return (
    <>
      <div>
        <PageTitle withBackButton={false}>
          <>
            <Icon name="ppo-logo" width={size} height={size} />
            &nbsp;PPO
          </>
        </PageTitle>
        <PageDescription>
          <Trans>
            PPO is prePO&apos;s governance and utility token.
            <br /> PPO&apos;s tokenomics design incentivizes high-quality, active participation and
            long-term alignment.
          </Trans>
          <br />
          <LearnMore href="https://docs.prepo.io/tokenomics" />
        </PageDescription>
      </div>
      <ButtonGrid items={ppoItems} />
    </>
  )
}

export default observer(OverviewPage)
