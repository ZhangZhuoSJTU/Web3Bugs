import { useState } from 'react'
import styled, { Color } from 'styled-components'
import { media, spacingIncrement, Button, Icon, IconName } from 'prepo-ui'
import IconTitle from './IconTitle'
import useResponsive from '../hooks/useResponsive'

const MIN_SHOWN = 3

type ListData = {
  iconName: IconName
  label: string
  secondaryLabel: string
  description: string
}

type Props = {
  backgroundColor?: keyof Color
  label: string
  minShown?: number
  itemName: string
  data: ListData[]
}

const Wrapper = styled.div<{ backgroundColor?: keyof Color }>`
  background-color: ${({ backgroundColor, theme }): string =>
    theme.color[backgroundColor || 'neutral9']};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  padding: ${spacingIncrement(20)};
`

const Head = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${spacingIncrement(25)};
`

const Title = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
    color: ${({ theme }): string => theme.color.neutral4};
  `}
`

const Body = styled.div``

const ListItemWrapper = styled.div<{ hidden: boolean }>`
  align-items: center;
  display: ${({ hidden }): string => (hidden ? 'none' : 'flex')};
  justify-content: space-between;
  margin-bottom: ${spacingIncrement(25)};

  &:last-child {
    margin-bottom: 0;
  }
`

const LeftItem = styled.div``

const RightItem = styled.div`
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  text-align: right;
`

const SecondaryLabel = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.sm};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  `}
`

const LabelDescription = styled.div`
  color: ${({ theme }): string => theme.color.neutral5};
  font-size: ${({ theme }): string => theme.fontSize['2xs']};
  line-height: 0.5;

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
    color: ${({ theme }): string => theme.color.neutral1};
  `}
`

const Footer = styled.div`
  display: flex;
  justify-content: center;
`

const getItemName = (amountLeftToShowInList: number, itemName: string): string => {
  if (amountLeftToShowInList === 1) {
    return itemName
  }

  return `${itemName}s`
}

type ListItemProps = {
  dataItem: ListData
  hidden: boolean
}

const ListItem: React.FC<ListItemProps> = ({ dataItem, hidden }) => {
  const { isDesktop } = useResponsive()
  const iconText = isDesktop ? 'base' : 'sm'
  const iconTextWeight = isDesktop ? 'semiBold' : 'medium'

  const applyBracketsForMobile = (text: string): string => (!isDesktop ? `(${text})` : text)

  return (
    <ListItemWrapper key={dataItem.label} hidden={hidden}>
      <LeftItem>
        <IconTitle
          iconName={dataItem.iconName}
          color="neutral1"
          weight={iconTextWeight}
          iconSize={24}
          labelFontSize={iconText}
        >
          {dataItem.label}
        </IconTitle>
      </LeftItem>
      {isDesktop && <LabelDescription>{dataItem.description}</LabelDescription>}
      <RightItem>
        <SecondaryLabel>{dataItem.secondaryLabel}</SecondaryLabel>
        {!isDesktop && (
          <LabelDescription>{applyBracketsForMobile(dataItem.description)}</LabelDescription>
        )}
      </RightItem>
    </ListItemWrapper>
  )
}

const ListCard: React.FC<Props> = ({
  label,
  minShown = MIN_SHOWN,
  data,
  itemName,
  backgroundColor,
}) => {
  const [showAll, setShowAll] = useState<boolean>(false)
  const amountLeftToShowInList = data.length > minShown ? data.length - minShown : 0

  const onClick = (): void => {
    setShowAll(!showAll)
  }

  return (
    <Wrapper backgroundColor={backgroundColor}>
      <Head>
        <Title>{label}</Title>
        {showAll && <Icon name="minus" color="neutral5" onClick={onClick} />}
      </Head>
      <Body>
        {data.map((dataItem, i) => (
          <ListItem key={dataItem.label} dataItem={dataItem} hidden={!showAll && i >= minShown} />
        ))}
      </Body>
      {!showAll && amountLeftToShowInList !== 0 && (
        <Footer>
          <Button type="text" onClick={onClick}>
            +{amountLeftToShowInList} {getItemName(amountLeftToShowInList, itemName)}
          </Button>
        </Footer>
      )}
    </Wrapper>
  )
}

export default ListCard
