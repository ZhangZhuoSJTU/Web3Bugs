import { t } from '@lingui/macro'
import { Col, Row } from 'antd'
import { observer } from 'mobx-react-lite'
import { useEffect, useRef, useState } from 'react'
import FinancialInfoCard from '../../components/FinancialInfoCard'
import useSelectedMarket from '../../hooks/useSelectedMarket'
import { getFullDateFromMs, getFullDateShortenMonthFromMs } from '../../utils/date-utils'
import { numberFormatter } from '../../utils/numberFormatter'
import { EstimatedValuation, ExpiryDate, PayoutRange } from '../definitions'

const DATE_BREAKPOINT = 250
const { percent } = numberFormatter

const MarketDataColumn: React.FC = () => {
  const selectedMarket = useSelectedMarket()
  const containerRef = useRef<HTMLDivElement>(null)
  const [shortDate, setShortDate] = useState(false)
  const observerRef = useRef(
    new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      if (width > DATE_BREAKPOINT) {
        setShortDate(false)
      } else {
        setShortDate(true)
      }
    })
  )
  const container = containerRef.current
  const { significantDigits } = numberFormatter

  useEffect(() => {
    const obs = observerRef.current
    if (container) {
      obs.observe(container)
    }

    return (): void => {
      if (container) {
        obs.unobserve(container)
      }
    }
  }, [container])

  if (selectedMarket === undefined) return null
  const { name, estimatedValuation, liquidity, expiryTime, payoutRange, tradingVolume } =
    selectedMarket

  const renderPayoutRange = (): React.ReactNode => {
    if (!payoutRange) return null
    const floorRange = percent(`${payoutRange[0]}`, 0)
    const ceilingRange = percent(`${payoutRange[1]}`, 0)
    return (
      <Col xs={24}>
        <FinancialInfoCard
          title={t`Payout Range`}
          tooltip={<PayoutRange />}
          value={`${floorRange} - ${ceilingRange}`}
        />
      </Col>
    )
  }

  return (
    <Row gutter={[0, 16]}>
      {estimatedValuation && (
        <Col xs={24}>
          <FinancialInfoCard
            title={t`Estimated Valuation`}
            tooltip={<EstimatedValuation marketName={name} />}
            value={`$${significantDigits(estimatedValuation.value)}`}
          />
        </Col>
      )}
      {tradingVolume && (
        <Col xs={24}>
          <FinancialInfoCard
            title={t`Trading Volume`}
            value={`$${significantDigits(tradingVolume.value)}`}
          />
        </Col>
      )}
      {liquidity && (
        <Col xs={24}>
          <FinancialInfoCard
            title={t`Liquidity`}
            value={`$${significantDigits(liquidity.value)}`}
          />
        </Col>
      )}
      {expiryTime && (
        <Col xs={24} ref={containerRef}>
          <FinancialInfoCard
            title={t`Market Expiry Date`}
            tooltip={<ExpiryDate />}
            value={
              shortDate ? getFullDateShortenMonthFromMs(expiryTime) : getFullDateFromMs(expiryTime)
            }
          />
        </Col>
      )}
      {renderPayoutRange()}
    </Row>
  )
}

export default observer(MarketDataColumn)
