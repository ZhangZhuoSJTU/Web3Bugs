import { Box, Flex, Icon, IconName, Typography } from 'prepo-ui'
import { truncateAmountString } from 'prepo-utils'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import Skeleton from 'react-loading-skeleton'
import styled from 'styled-components'
import Percent from '../../components/Percent'
import { useRootStore } from '../../context/RootStoreProvider'
import { numberFormatter } from '../../utils/numberFormatter'

const { toUsd } = numberFormatter

type GrowthProps = {
  amount: number
  percentage: number
}

type PortfolioBreakdownItemProps = {
  comingSoon?: boolean
  iconName: IconName
  label: string
  value?: number | string
  growth?: GrowthProps
}

const SkeletonWrapper = styled.div`
  line-height: 1;
`

const transformPercent = (percentValue: string, amount: number): string =>
  `${truncateAmountString(`${amount}`)} (${percentValue})`

const PortfolioBreakdownItem: React.FC<PortfolioBreakdownItemProps> = ({
  comingSoon,
  iconName,
  growth,
  label,
  value,
}) => {
  const { web3Store } = useRootStore()
  const { connected } = web3Store

  const renderValue = useMemo(() => {
    if (!connected) return '-'
    if (value === undefined)
      return (
        <SkeletonWrapper>
          <Skeleton height={18} width={70} />
        </SkeletonWrapper>
      )
    return `${toUsd(value)}`
  }, [connected, value])

  return (
    <Box borderTopColor="accent1" borderTopWidth={1} borderTopStyle="solid" px={25} py={10}>
      <Flex>
        <Icon height="21" width="21" name={iconName} />
        <Flex justifyContent="space-between" width="100%">
          <Typography color="neutral4" variant="text-medium-md" ml={10}>
            {label}
          </Typography>
          <Typography color="neutral4" variant="text-medium-md">
            {renderValue}
          </Typography>
        </Flex>
      </Flex>
      <Flex alignItems="flex-end" flexDirection="column">
        {comingSoon && (
          <Typography color="primary" variant="text-medium-sm" textAlign="right">
            (Coming soon)
          </Typography>
        )}
        {growth && (
          <Percent
            format={(percentValue): string => transformPercent(percentValue, growth.amount)}
            percentagePrecision={0}
            styles={{
              fontWeight: 'medium',
            }}
            value={growth.percentage}
          />
        )}
      </Flex>
    </Box>
  )
}

export default observer(PortfolioBreakdownItem)
