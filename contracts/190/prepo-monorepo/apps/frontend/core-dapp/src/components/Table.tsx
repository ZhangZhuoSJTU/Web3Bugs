import { Col, Row } from 'antd'
import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import Subtitle from './Subtitle'
import Percent from './Percent'
import { PositionType } from '../utils/prepo.types'
import PositionLabel from '../features/position/PositionLabel'
import { numberFormatter } from '../utils/numberFormatter'

const { toUsd } = numberFormatter

export type RowData = {
  label: string
  tooltip?: React.ReactNode
  amount?: number | string
  percent?: number
  ignoreFormatAmount?: boolean
  market?: {
    name: string
    position: PositionType
  }
  warning?: boolean
}

const Wrapper = styled.div<{ hideBorder: boolean; padding: number }>`
  border-bottom: 1px solid
    ${({ theme, hideBorder }): string => (!hideBorder ? theme.color.primaryAccent : 'transparent')};

  :last-child {
    border-bottom: none;
  }

  &&& {
    .ant-row {
      padding: ${({ padding }): string => spacingIncrement(padding)};
      padding-left: 0;
      padding-right: 0;
    }
  }
`

const PercentWrapper = styled.div`
  display: inline-block;
`

const Right = styled(Col)<{ $warning?: boolean }>`
  color: ${({ theme, $warning }): string => ($warning ? theme.color.error : theme.color.neutral1)};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  text-align: right;
`

type Props = {
  data: RowData[]
  hideBorder?: boolean
  padding?: 'sm' | 'md'
  percentagePrecision?: number
}

const Table: React.FC<Props> = ({
  data,
  padding = 'md',
  percentagePrecision = 0,
  hideBorder = false,
}) => {
  const TABLE_PADDING = {
    sm: 2,
    md: 12,
  }

  const renderRightSide = (dataItem: RowData): React.ReactNode | null => {
    if (dataItem?.amount !== undefined) {
      return (
        <>
          {!dataItem.ignoreFormatAmount ? toUsd(dataItem.amount) : dataItem.amount}{' '}
          {dataItem.percent && (
            <PercentWrapper>
              <Percent
                showPlusSign
                value={dataItem.percent}
                percentagePrecision={percentagePrecision}
                format={(percentValue): string => `(${percentValue})`}
              />
            </PercentWrapper>
          )}
        </>
      )
    }

    if (dataItem?.market) {
      return (
        <>
          <div>{dataItem?.market.name}</div>
          <PositionLabel positionType={dataItem?.market.position} />
        </>
      )
    }

    return null
  }

  return (
    <div>
      {data.map((dataItem) => (
        <Wrapper key={dataItem.label} hideBorder={hideBorder} padding={TABLE_PADDING[padding]}>
          <Row>
            <Col xs={18}>
              <Subtitle tooltip={dataItem.tooltip}>{dataItem.label}</Subtitle>
            </Col>
            <Right $warning={dataItem.warning} xs={6}>
              {renderRightSide(dataItem)}
            </Right>
          </Row>
        </Wrapper>
      ))}
    </div>
  )
}

export default Table
