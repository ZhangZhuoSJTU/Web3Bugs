import { Box, Flex, Icon } from 'prepo-ui'
import React, { useEffect } from 'react'
import { Color, useTheme } from 'styled-components'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { t, Trans } from '@lingui/macro'
import PpoBox from './PpoBox'
import ProfileBanner from './ProfileBanner'
import ProfileAccordion from './ProfileAccordion'
import TotalMultiplier from './TotalMultiplier'
import TotalEarned from './TotalEarned'
import ProfileVotingPower from './ProfileVotingPower'
import LookupUser from './LookupUser'
import PageTitle from '../ppo/PageTitle'
import useResponsive from '../../hooks/useResponsive'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'
import { getShortAccount } from '../../utils/account-utils'
import { DelegateEntity } from '../../stores/entities/DelegateEntity'

const iconDimensions = {
  energy: {
    desktop: {
      width: '24',
      height: '32',
    },
    mobile: {
      width: '12',
      height: '16',
    },
  },
  logo: {
    desktop: {
      width: 62,
      height: 62,
    },
    mobile: {
      width: 33,
      height: 33,
    },
  },
}

const POWER_MOCK = 0

const TOTAL_MULTIPLIER_MOCK = 1
const STAKE_TIME_MOCK = '-'
const TIME_MULTIPLIER_MOCK = 1
const NEXT_TIME_MULTIPLIER_MOCK = 1
const DAYS_TILL_NEXT_TIME_MULTIPLIER_MOCK = '-'
const PERMANENT_MULTIPLIER_MOCK = 1
const TEMPROARY_MULTIPLIER_MOCK = 0.0
const PPO_RATE_MOCK = 1
const NEXT_DISTRIBUTION_DATE_MOCK = '-'

const getTitlePrefix = (delegate?: DelegateEntity): string => {
  const prefix = delegate?.ensName ?? getShortAccount(delegate?.delegateAddress)
  return prefix ? `${prefix}'s ` : ''
}

const ProfilePage: React.FC = () => {
  const { isDesktop } = useResponsive()
  const theme = useTheme()
  const energy = isDesktop ? iconDimensions.energy.desktop : iconDimensions.energy.mobile
  const logo = isDesktop ? iconDimensions.logo.desktop : iconDimensions.logo.mobile
  const iconFill: keyof Color = theme.isDarkMode ? 'primaryLight' : 'white'

  const {
    web3Store: { connected },
    delegateStore: { selfDelegate, customDelegate, onChangeEnsName, loading },
  } = useRootStore()
  const {
    query: { search: profileAddress = '' },
  } = useRouter()

  useEffect(() => {
    if (typeof profileAddress === 'string') onChangeEnsName(profileAddress)
  }, [profileAddress, onChangeEnsName])

  const isCustom =
    profileAddress === customDelegate?.delegateAddress || profileAddress === customDelegate?.ensName
  const delegate = isCustom ? customDelegate : selfDelegate
  const prefix = isCustom ? getTitlePrefix(customDelegate) : getTitlePrefix(selfDelegate)
  const mockedValue = connected ? POWER_MOCK : undefined

  return (
    <Flex
      flexDirection="column"
      justifyContent="flex-start"
      gap={16}
      mx="auto"
      maxWidth={884}
      alignItems="stretch"
    >
      <PageTitle href={isCustom ? Routes.Profile : Routes.PPO}>
        {prefix}
        <Trans>Profile</Trans>
      </PageTitle>
      <Flex flexDirection="column" gap={16} alignItems="stretch" mt={14}>
        {false && <ProfileBanner type="preacher" />}
        {false && <ProfileBanner type="elitePregen" />}
        {false && <ProfileBanner type="executive" />}
      </Flex>

      <ProfileAccordion>
        <Flex
          alignItems="flex-start"
          borderTop={`1px solid ${theme.color.neutral8}`}
          borderBottom={`1px solid ${theme.color.neutral8}`}
        >
          <PpoBox
            title={t`PPO Staked`}
            icon={
              <Icon
                name="ppo-logo"
                color="primaryLight"
                width={`${logo.width}px`}
                height={`${logo.height}px`}
              />
            }
            loading={loading}
            value={mockedValue}
            suffix="PPO"
          />
          <Box width="1px" background="neutral8" alignSelf="stretch" />
          <PpoBox
            title={t`PPO Power`}
            value={mockedValue}
            loading={loading}
            suffix="PPO"
            icon={
              <Flex
                width={logo.width}
                height={logo.height}
                background="searchInputBorder"
                borderRadius="50%"
              >
                <Icon name="energy" color={iconFill} width={energy.width} height={energy.height} />
              </Flex>
            }
            tooltipText={t`PPO Staked x Total Multiplier`}
          />
        </Flex>
        <Flex flexDirection={{ phone: 'column', desktop: 'row' }} alignItems="stretch">
          <Flex flexDirection="column" alignItems="stretch" flex={1}>
            <TotalMultiplier
              connected={connected}
              totalMulitplier={TOTAL_MULTIPLIER_MOCK}
              stakeTime={STAKE_TIME_MOCK}
              timeMultiplier={TIME_MULTIPLIER_MOCK}
              daysTillNextTimeMultiplier={DAYS_TILL_NEXT_TIME_MULTIPLIER_MOCK}
              nextTimeMultiplier={NEXT_TIME_MULTIPLIER_MOCK}
              temporaryMultiplier={TEMPROARY_MULTIPLIER_MOCK}
              permanentMultiplier={PERMANENT_MULTIPLIER_MOCK}
            />
            <ProfileVotingPower delegate={delegate} />
          </Flex>
          <Box
            width={{ phone: '100%', desktop: '1px' }}
            minHeight={{ phone: '1px', desktop: '100%' }}
            background="neutral8"
          />
          <TotalEarned
            connected={connected}
            ppoRate={connected ? PPO_RATE_MOCK : undefined}
            totalPpo={mockedValue}
            nextDistributionDate={connected ? NEXT_DISTRIBUTION_DATE_MOCK : undefined}
          />
        </Flex>
      </ProfileAccordion>
      <LookupUser />
    </Flex>
  )
}

export default observer(ProfilePage)
