import React from 'react'
import styled from 'styled-components'
import { Col, Row } from 'antd'
import OutcomeTableRoi from './OutcomeTableRoi'
import { spacingIncrement } from '../app/themes'
import { media } from '../../utils/media'
import { formatUsd } from '../../helpers'
import InfoTooltipIcon from '../icons/InfoTooltipIcon'
import useBreakpoint from '../../hooks/useBreakpoint'
import { bigAmountToUsd } from '../../utils/number-utils'
import { UNKNOWN_TABLE_ROW_ROI } from '../../constants'
import Minus from '../../assets/images/minus.svg'
import Plus from '../../assets/images/plus.svg'

const Wrapper = styled.div<{ canEdit: boolean }>`
  background-color: ${({ theme }): string => theme.colors.foreground};
  border: ${({ canEdit, theme }): string =>
    `3px solid ${canEdit ? theme.colors.primaryLight : theme.colors.buttonLight}`};
  border-top: none;
  color: ${({ theme }): string => theme.colors.textPrimary};
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  padding: ${spacingIncrement(1)};

  &:last-child {
    border-bottom-left-radius: 0.75rem;
    border-bottom-right-radius: 0.75rem;
  }
`

const Left = styled(Col)`
  align-items: center;
  display: flex;
  height: 1.5rem;
  justify-content: flex-start;
  line-height: 1.5rem;
  padding-left: ${spacingIncrement(1)};

  ${media.lg`
    padding-left: 0;
  `}
`

const Right = styled(Col)`
  font-weight: 800;
  height: 1.5rem;
  line-height: 1.5rem;

  padding-right: ${spacingIncrement(1)};
  text-align: right;

  ${media.lg`
    padding-right: ${spacingIncrement(1)};
  `}
`

const RightContainer = styled(Row)`
  text-align: right;
`

const SignImg = styled.img<{ minWidth: string }>`
  margin-right: 1rem;
  width: 1rem;

  ${media.lg`
    display: none;
  `}
`

const Span = styled.span<{ canEdit?: boolean }>`
  color: ${({ canEdit, theme }): string =>
    canEdit ? theme.colors.textPrimary : theme.colors.accent};
`

export type RowData = {
  signImg?: 'minus' | 'plus'
  label: string
  toolTip?: string
  fee: number
  roi: number
} & {
  isEditing?: boolean
  editComponent?: React.ReactNode
  canEdit?: boolean
}

type Props = RowData

const EditTableLayout: React.FC = ({ children }) => (
  <RightContainer>
    <Col xs={24}>{children}</Col>
  </RightContainer>
)

const OutcomeTableRow: React.FC<Props> = ({
  fee,
  roi,
  signImg = undefined,
  label,
  toolTip,
  isEditing,
  canEdit = false,
  editComponent,
}) => {
  const shouldRenderEditButton = editComponent && isEditing
  const breakpoint = useBreakpoint()
  const formatAmount = breakpoint === 'lg' ? formatUsd : bigAmountToUsd

  const renderRightContainer = (): React.ReactNode => {
    if (canEdit) {
      return (
        <>
          <Col xs={16} md={10} lg={18}>
            <span>{formatAmount(Math.abs(fee))}</span>
          </Col>
          <Col xs={8} md={6} lg={6}>
            <OutcomeTableRoi roi={roi} />
          </Col>
        </>
      )
    }

    return (
      <Col xs={24}>
        <Span canEdit={canEdit}>{UNKNOWN_TABLE_ROW_ROI}</Span>
      </Col>
    )
  }

  return (
    <Wrapper canEdit={canEdit}>
      <Row>
        <Left xs={12} md={12}>
          {signImg && <SignImg src={signImg === 'minus' ? Minus : Plus} minWidth="22.5rem" />}
          {label}
          {toolTip && <InfoTooltipIcon text={toolTip} />}
        </Left>
        <Right xs={12} md={12}>
          {shouldRenderEditButton ? (
            <EditTableLayout>{editComponent}</EditTableLayout>
          ) : (
            <RightContainer justify="end">{renderRightContainer()}</RightContainer>
          )}
        </Right>
      </Row>
    </Wrapper>
  )
}

export default OutcomeTableRow
