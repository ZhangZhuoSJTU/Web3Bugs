import { t, Trans } from '@lingui/macro'
import { observer } from 'mobx-react-lite'
import { NETWORKS } from 'prepo-constants'
import { Box, Flex, Typography } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'
import { getFullDateTimeFromSeconds } from '../../utils/date-utils'
import Record, { RecordButtonColors, RecordSkeleton } from '../portfolio/Record'

const DEFAULT_COLORS: RecordButtonColors = {
  backgroundColor: 'accentPrimary',
  color: 'primaryWhite',
}

const buttonColors: { [key: string]: RecordButtonColors } = {
  Withdrawn: {
    backgroundColor: 'accentWarning',
    color: 'warning',
  },
  Deposited: {
    backgroundColor: 'accentWarning',
    color: 'warning',
  },
  Opened: {
    backgroundColor: 'accentSuccess',
    color: 'success',
  },
  Closed: {
    backgroundColor: 'accentError',
    color: 'error',
  },
}

const History: React.FC = () => {
  const {
    portfolioStore: { historicalEvents },
    web3Store,
  } = useRootStore()
  const { connected, network } = web3Store

  if (!connected)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} textAlign="center" variant="text-regular-base">
          <Trans>Your wallet is not connected.</Trans>
        </Typography>
      </Flex>
    )

  if (historicalEvents === undefined)
    return (
      <Box>
        <RecordSkeleton />
        <RecordSkeleton />
        <RecordSkeleton />
      </Box>
    )

  if (historicalEvents.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          <Trans>No transaction history.</Trans>
        </Typography>
      </Flex>
    )

  return (
    <Box>
      {historicalEvents.map(
        ({ iconName, event, name, timestamp, transactionHash, usdValue, eventType, marketId }) => {
          let nameRedirectUrl: string | undefined
          if ((marketId !== undefined && event === 'Opened') || event === 'Closed')
            nameRedirectUrl = `/markets/${marketId}/trade`
          if (event === 'Deposited') nameRedirectUrl = '/portfolio/deposit'
          if (event === 'Withdrawn') nameRedirectUrl = '/portfolio/withdraw'

          return (
            <Record
              key={transactionHash}
              iconName={iconName}
              name={name}
              nameRedirectUrl={nameRedirectUrl}
              position={eventType}
              buttonStyles={buttonColors[event] ?? DEFAULT_COLORS}
              data={[
                {
                  label: t`Value`,
                  amount: usdValue,
                },
                {
                  label: t`Transaction Time`,
                  amount: getFullDateTimeFromSeconds(timestamp),
                  usd: false,
                },
              ]}
              buttonLabel={event}
              target="_blank"
              href={`${NETWORKS[network.name].blockExplorer}/tx/${transactionHash}`}
            />
          )
        }
      )}
    </Box>
  )
}

export default observer(History)
