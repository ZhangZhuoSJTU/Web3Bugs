import { Col, Row } from 'antd'
import React from 'react'
import styled from 'styled-components'
import Card from './Card'
import EditIcon from './EditIcon'

const AccordionWrapper = styled.div<{ show: boolean }>`
  display: ${({ show }): string => (show ? 'block' : 'none')};
`

const Summary = styled.div<{ show: boolean }>`
  display: ${({ show }): string => (show ? 'block' : 'none')};
`

const Right = styled(Col)`
  align-items: center;
  display: flex;
`

type Props = {
  className?: string
  show: boolean
  summary: React.ReactNode
  onEdit: () => void
  noPadding?: boolean
}

const Accordion: React.FC<Props> = ({
  noPadding = false,
  className,
  show,
  summary,
  onEdit,
  children,
}) => (
  <Card className={className} noPadding={noPadding}>
    <Summary show={!show}>
      <Row>
        <Col xs={22}>{summary}</Col>
        <Right xs={2}>
          <EditIcon onClick={onEdit} />
        </Right>
      </Row>
    </Summary>
    <AccordionWrapper show={show}>{children}</AccordionWrapper>
  </Card>
)

export default Accordion
