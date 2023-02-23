import { Box, Button, Flex, spacingIncrement, Typography } from 'prepo-ui'
import { getShortAccount } from 'prepo-utils'
import { Trans } from '@lingui/macro'
import { Label } from './FromPower'
import { Routes } from '../../../lib/routes'
import useResponsive from '../../../hooks/useResponsive'
import { useRootStore } from '../../../context/RootStoreProvider'
import AddressAvatar from '../../delegate/AddressAvatar'

const avatarDiameter = {
  desktop: 32,
  mobile: 24,
}

const DelegatedTo: React.FC = () => {
  const { isDesktop } = useResponsive()
  const {
    web3Store: { connected },
    uiStore: { disableMocks },
    delegateStore: { selectedDelegate, loading },
  } = useRootStore()
  const delegateAddress = selectedDelegate?.delegateAddress ?? ''

  return (
    <Box mt={{ phone: 12, desktop: 20 }}>
      {connected && (
        <Label>
          <Trans>Voting Power Delegated To</Trans>
        </Label>
      )}

      <Flex flexDirection="column" gap={{ phone: 14, desktop: 20 }} alignItems="stretch">
        {connected && (
          <Typography
            gap={10}
            mt={10}
            display="flex"
            variant="text-medium-md"
            color="neutral1"
            justifyContent="flex-start"
            alignItems="center"
            lineHeight="auto"
          >
            <AddressAvatar
              loading={loading}
              avatarDiameter={avatarDiameter}
              avatarUrl={selectedDelegate?.avatar}
              address={selectedDelegate?.delegateAddress}
            />
            {getShortAccount(delegateAddress)}
          </Typography>
        )}

        <Button type="primary" href={Routes.Delegate} block disabled={disableMocks}>
          <Trans>Change Delegate</Trans>
        </Button>
        <Button
          block
          style={{
            height: spacingIncrement(isDesktop ? 78 : 54),
          }}
          disabled={disableMocks}
          customColors={{
            border: 'primaryAccent',
            background: 'primaryAccent',
            hoverBackground: 'primaryAccent',
            hoverBorder: 'primaryAccent',
          }}
        >
          <Trans>Undelegate</Trans>
        </Button>
      </Flex>
    </Box>
  )
}

export default DelegatedTo
