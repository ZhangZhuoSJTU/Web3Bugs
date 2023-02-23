import { ButtonColors, Flex, IconName, media, spacingIncrement, Typography } from 'prepo-ui'
import { useMemo } from 'react'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import SectionAccordion from './SectionAccordion'
import Details, { loadValue } from './Details'
import ButtonLink from '../ppo/ButtonLink'
import { Routes } from '../../lib/routes'

const BOND_MOCK = 0
const STAKE_MOCK = 0
const GOVERN_MOCK = 0
const TRADE_MOCK = 0
const LIQUIDITY_MOCK = 0

export const CUSTOM_STYLE: ButtonColors = {
  background: 'primaryAccent',
  border: 'primaryAccent',
  hoverBackground: 'primaryAccent',
  hoverBorder: 'primaryAccent',
}

type DetailInfo = {
  tag: string
  title: string
  value?: number
  iconName: IconName
  href?: string
}

const StyledAccordion = styled(SectionAccordion)`
  flex: 1;
  > button {
    padding: ${spacingIncrement(24)} ${spacingIncrement(20)} ${spacingIncrement(20)}
      ${spacingIncrement(21)};
    ${media.desktop`
      padding: ${spacingIncrement(37)} ${spacingIncrement(46)} ${spacingIncrement(35)};
    `}
  }
`
const LinkWrapper = styled.div`
  button,
  a {
    width: ${spacingIncrement(90)};
    ${media.largeDesktop`
      width: ${spacingIncrement(125)};
    `}
  }
`

const TotalEarned: React.FC<{
  totalPpo?: number
  ppoRate?: number
  nextDistributionDate?: string
  connected: boolean
}> = ({ totalPpo, ppoRate, nextDistributionDate, connected }) => {
  const details = useMemo(
    (): DetailInfo[] => [
      {
        title: 'Bonding',
        tag: 'Bond',
        iconName: 'colored-bond',
        value: BOND_MOCK,
      },
      {
        title: 'Staking',
        tag: 'Stake',
        iconName: 'colored-stake',
        value: STAKE_MOCK,
        href: Routes.Stake,
      },
      {
        title: 'Governance',
        tag: 'Govern',
        iconName: 'colored-legal',
        value: GOVERN_MOCK,
        href: Routes.Govern,
      },
      {
        title: 'Trading',
        tag: 'Trade',
        iconName: 'colored-trade',
        value: TRADE_MOCK,
      },
      {
        title: 'Liquidity',
        tag: 'LP',
        iconName: 'colored-liquidity',
        value: LIQUIDITY_MOCK,
      },
    ],
    []
  )

  const valueInUSD = useMemo(() => {
    if (ppoRate === undefined || totalPpo === undefined) return undefined
    return ppoRate * totalPpo
  }, [ppoRate, totalPpo])

  return (
    <StyledAccordion
      title={
        <Flex flexDirection="column" gap={4} alignItems="flex-start">
          <Typography variant="text-medium-md" color="neutral3">
            <Trans>Total Earned</Trans>
          </Typography>
          <Typography
            variant="text-medium-base"
            display="flex"
            alignItems="center"
            color="neutral4"
          >
            {totalPpo !== undefined && valueInUSD !== undefined ? (
              <>
                <Typography variant="text-semiBold-xl" color="neutral1">
                  {`${totalPpo} PPO`}
                </Typography>
                &nbsp;&#8776; ${valueInUSD}
              </>
            ) : (
              '-'
            )}
          </Typography>
          <Typography variant="text-medium-sm" color="neutral3" display="flex" alignItems="center">
            <Trans>Next Distribution Date:</Trans>&nbsp;{loadValue(nextDistributionDate)}
          </Typography>
        </Flex>
      }
    >
      {details.map(({ title, iconName, tag, value, href }) => (
        <Details
          title={title}
          key={title}
          iconName={iconName}
          options={{ titleColor: 'neutral3', descriptionColor: 'neutral4' }}
          description={
            <Typography variant="text-bold-md" as="span">
              {loadValue(value, '', connected)}
            </Typography>
          }
          value={
            <LinkWrapper>
              <ButtonLink href={href} title={tag} customStyles={CUSTOM_STYLE} />
            </LinkWrapper>
          }
        />
      ))}
    </StyledAccordion>
  )
}

export default TotalEarned
