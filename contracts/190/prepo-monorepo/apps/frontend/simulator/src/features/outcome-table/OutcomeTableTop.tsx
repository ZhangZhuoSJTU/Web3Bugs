import { Col, Row } from 'antd'
import React from 'react'
import styled from 'styled-components'
import OutcomeTableRoi from './OutcomeTableRoi'
import { spacingIncrement } from '../app/themes'
import { media } from '../../utils/media'
import EditIcon from '../../components/EditIcon'
import Button from '../../components/Button'
import { bigAmountToUsd } from '../../utils/number-utils'
import useBreakpoint from '../../hooks/useBreakpoint'
import { formatUsd } from '../../helpers'
import { UNKNOWN_TABLE_TOP_ROI } from '../../constants'

const Left = styled(Col)`
  padding-left: ${spacingIncrement(1)};

  ${media.lg`
    padding-left: ${spacingIncrement(0.5)};
  `}
`

const Right = styled(Col)`
  padding-right: ${spacingIncrement(1)};
  text-align: right;

  ${media.lg`
    padding-right: ${spacingIncrement(0.5)};
  `}
`

const RightContainer = styled(Row)`
  align-items: center;
  display: flex;
  text-align: right;
`

const Wrapper = styled.div<{ canEdit: boolean }>`
  background-color: ${({ canEdit, theme }): string =>
    canEdit ? theme.colors.primary : theme.colors.buttonLight};
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
  color: ${({ canEdit, theme }): string =>
    canEdit ? theme.colors.textSecondary : theme.colors.accent};
  font-size: ${({ theme }): string => theme.fontSize.lg};
  font-weight: 800;
  padding: ${spacingIncrement(1)};
`

const ProfitSymbol = styled.span`
  font-size: ${({ theme }): string => theme.fontSize.lg};
  margin-right: ${spacingIncrement(1)};
`

const Profit = styled.span`
  font-size: ${({ theme }): string => theme.fontSize.lgx};
`

type Props = {
  label: string
  profit: number
  roi: number
  isEditing?: boolean
  onEdit?: () => void
  canEdit?: boolean
}

const renderSymbol = (profit: number): string => (profit >= 0 ? '+' : '-')

const OutcomeTableTop: React.FC<Props> = ({
  label,
  profit,
  roi,
  isEditing = false,
  onEdit,
  canEdit = false,
}) => {
  const breakpoint = useBreakpoint()
  const formatAmount = breakpoint === 'lg' ? formatUsd : bigAmountToUsd

  const renderEditSaveButton = (): React.ReactNode | null => {
    if (!onEdit || !canEdit) return null

    return isEditing ? (
      <Button
        size="small"
        onClick={(): void => {
          onEdit()
        }}
      >
        Update
      </Button>
    ) : (
      <EditIcon
        onClick={(): void => {
          onEdit()
        }}
      />
    )
  }

  const renderRightContainer = (): React.ReactNode => {
    if (canEdit) {
      return (
        <>
          <Col xs={16} md={10} lg={18}>
            <ProfitSymbol>{renderSymbol(profit)}</ProfitSymbol>
            <Profit>{formatAmount(Math.abs(profit))}</Profit>
          </Col>
          <Col xs={8} md={6} lg={6}>
            <OutcomeTableRoi primary roi={roi} />
          </Col>
        </>
      )
    }

    return <Col xs={24}>{UNKNOWN_TABLE_TOP_ROI}</Col>
  }

  return (
    <Wrapper canEdit={canEdit}>
      <Row>
        <Left xs={11} md={12}>
          {label} {renderEditSaveButton()}
        </Left>

        <Right xs={13} md={12}>
          <RightContainer justify="end">{renderRightContainer()}</RightContainer>
        </Right>
      </Row>
    </Wrapper>
  )
}

export default OutcomeTableTop
