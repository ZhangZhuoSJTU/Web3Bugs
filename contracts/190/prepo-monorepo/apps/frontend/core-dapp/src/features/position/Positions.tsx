import { Box, Button, Flex, Typography } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { t, Trans } from '@lingui/macro'
import ClosePositionSummary from './ClosePositionSummary'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'
import Record, { RecordSkeleton } from '../portfolio/Record'

const Positions: React.FC = () => {
  const { portfolioStore, web3Store } = useRootStore()
  const { positions, selectedPosition, setSelectedPosition } = portfolioStore
  const { connected } = web3Store

  if (!connected)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} textAlign="center" variant="text-regular-base">
          <Trans>Your wallet is not connected.</Trans>
        </Typography>
      </Flex>
    )

  if (positions.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          <Trans>No position found!</Trans>
        </Typography>
        <Button type="primary" size="sm" href={Routes.Markets}>
          <Trans>Trade Now</Trans>
        </Button>
      </Flex>
    )

  return (
    <Box position="relative">
      {positions.map(({ position, market, data }) => {
        const key = `${position}_${market.urlId}`
        if (!data) return <RecordSkeleton key={key} />
        return (
          <Record
            key={key}
            iconName={market.iconName}
            name={market.name}
            nameRedirectUrl={`/markets/${market.urlId}/trade`}
            position={position}
            buttonLabel={t`Close Position`}
            buttonStyles={{
              backgroundColor: 'primaryAccent',
              color: 'primaryWhite',
            }}
            data={[
              {
                label: 'PNL',
                amount: data.pnl,
                percent: data.percentage,
              },
              {
                label: t`Total Value`,
                amount: data.totalValue,
                usd: true,
              },
            ]}
            onButtonClicked={(): void => setSelectedPosition({ position, market, data })}
          />
        )
      })}
      {selectedPosition && <ClosePositionSummary position={selectedPosition} />}
    </Box>
  )
}

export default observer(Positions)
