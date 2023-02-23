import { Trans } from '@lingui/macro'
import { Button, Icon, IconName, media, spacingIncrement, Subtitle } from 'prepo-ui'
import { HTMLAttributeAnchorTarget, useMemo } from 'react'
import Skeleton from 'react-loading-skeleton'
import styled, { Color } from 'styled-components'
import Link from '../../components/Link'
import Percent from '../../components/Percent'
import { numberFormatter } from '../../utils/numberFormatter'
import { PositionType } from '../../utils/prepo.types'
import PositionLabel from '../position/PositionLabel'

const { toUsd } = numberFormatter

type Data = {
  amount?: number | string
  label: string
  percent?: number
  toolTip?: string
  usd?: boolean
}

export type RecordButtonColors = {
  backgroundColor: keyof Color
  color: keyof Color
}

type Props = {
  nameRedirectUrl?: string
  iconName: IconName
  name: string
  position?: PositionType
  href?: string
  target?: HTMLAttributeAnchorTarget
  data: Data[]
  onButtonClicked?: () => unknown
  buttonLabel: string
  buttonStyles?: RecordButtonColors
}

const Body = styled.div`
  margin-top: ${spacingIncrement(17)};
  ${media.largeDesktop`
    display: none;
  `}
`

const ButtonContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: flex-end;
`

const HideOnDesktop = styled.div`
  display: flex;
  ${media.largeDesktop`
        display: none;
    `}
`

const HideOnMobile = styled.div`
  display: none;
  ${media.largeDesktop`
        display: flex;
    `}
`

const IconTitleSkeleton = styled.div`
  align-items: center;
  display: grid;
  grid-column-gap: ${spacingIncrement(10)};
  grid-template-columns: ${spacingIncrement(28)} auto;
`

const MainRow = styled.div`
  align-items: center;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  justify-content: space-between;
  ${media.largeDesktop`
  grid-template-columns: 4fr 3fr 3fr 4fr;
    span {
      font-size: ${({ theme }): string => theme.fontSize.md};
    }
  `}
`

const Name = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.largeDesktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const NameLink = styled(Link)`
  :hover {
    p {
      color: ${({ theme }): string => theme.color.primary};
    }
  }
`

const NameWrapper = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(10)};
`

const PositionWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.largeDesktop`
    margin-top: ${spacingIncrement(8)};
  `}
`

const ResponsiveData = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  ${media.largeDesktop`
    align-items: start;
    flex-direction: column;
    justify-content: center;
  `}
`

const ResponsiveDataValue = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral1};
  display: flex;
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  text-align: right;
  p {
    margin-bottom: ${spacingIncrement(0)};
  }
  ${media.largeDesktop`
    text-align: left;
    font-size: ${({ theme }): string => theme.fontSize.base};
    white-space: nowrap;
  `}
`

const StyledPositionlabel = styled(PositionLabel)`
  display: inline-block;
  font-size: ${({ theme }): string => theme.fontSize.sm};
`

const StyledSubtitle = styled(Subtitle)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.largeDesktop`
    margin-bottom: ${spacingIncrement(8)};
  `}
`

const Wrapper = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.accent1};
  padding: ${spacingIncrement(14)} ${spacingIncrement(20)};
  &:last-child {
    border-bottom: none;
  }
`

export const RecordSkeleton: React.FC = () => (
  <Wrapper>
    <MainRow>
      <div>
        <IconTitleSkeleton>
          <Skeleton circle height={28} width={28} />
          <Skeleton height={20} width={80} />
        </IconTitleSkeleton>
        <Skeleton height={20} width={80} />
      </div>
      <div>
        <ResponsiveData>
          <Skeleton height={20} width={80} />
          <Skeleton height={20} width={60} />
        </ResponsiveData>
      </div>
      <div>
        <ResponsiveData>
          <Skeleton height={20} width={80} />
          <Skeleton height={20} width={60} />
        </ResponsiveData>
      </div>
      <Skeleton height={54} width="100%" />
    </MainRow>
    <Body>
      <MainRow>
        <Skeleton height={20} width={80} />
        <Skeleton height={20} width={60} />
      </MainRow>
    </Body>
  </Wrapper>
)

const Record: React.FC<Props> = ({
  buttonStyles,
  name,
  nameRedirectUrl,
  iconName,
  position,
  data,
  onButtonClicked,
  buttonLabel,
  href,
  target,
}) => {
  const renderData = useMemo(
    () =>
      data.map(({ label, toolTip, amount, percent, usd = true }) => ({
        id: `${label}_${amount}_${percent}`,
        content: (
          <ResponsiveData key={label}>
            <StyledSubtitle tooltip={toolTip}>{label}</StyledSubtitle>
            <ResponsiveDataValue>
              {amount === undefined ? (
                <Skeleton height={20} width={60} />
              ) : (
                <p>{usd ? toUsd(amount) : amount}&nbsp;</p>
              )}
              {percent !== undefined && (
                <Percent
                  showPlusSign
                  value={percent}
                  percentagePrecision={2}
                  format={(percentValue): string => `(${percentValue})`}
                />
              )}
            </ResponsiveDataValue>
          </ResponsiveData>
        ),
      })),
    [data]
  )

  return (
    <Wrapper>
      <MainRow>
        <div
          style={{
            minWidth: 0,
          }}
        >
          {nameRedirectUrl === undefined ? (
            <NameWrapper>
              <Icon name={iconName} height="30px" width="30px" />
              <Name>{name}</Name>
            </NameWrapper>
          ) : (
            <NameLink href={nameRedirectUrl}>
              <NameWrapper>
                <Icon name={iconName} height="30px" width="30px" />
                <Name>{name}</Name>
              </NameWrapper>
            </NameLink>
          )}
          {position !== undefined && (
            <HideOnMobile>
              <PositionWrapper>
                <Trans>Position</Trans>:&nbsp;
                <StyledPositionlabel positionType={position}>{position}</StyledPositionlabel>
              </PositionWrapper>
            </HideOnMobile>
          )}
        </div>
        {renderData.map(({ content, id }) => (
          <HideOnMobile key={id}>{content}</HideOnMobile>
        ))}
        <ButtonContainer>
          <Button
            onClick={onButtonClicked}
            href={href}
            target={target}
            customColors={{
              background: buttonStyles?.backgroundColor,
              border: buttonStyles?.backgroundColor,
              label: buttonStyles?.color,
              hoverBackground: buttonStyles?.backgroundColor,
              hoverBorder: buttonStyles?.backgroundColor,
              hoverLabel: buttonStyles?.color,
            }}
          >
            {buttonLabel}
          </Button>
        </ButtonContainer>
      </MainRow>
      {position !== undefined && (
        <HideOnDesktop>
          <PositionWrapper>
            <StyledPositionlabel positionType={position}>{position}</StyledPositionlabel>
          </PositionWrapper>
        </HideOnDesktop>
      )}
      <Body>
        {renderData.map(({ content, id }) => (
          <HideOnDesktop key={id}>{content}</HideOnDesktop>
        ))}
      </Body>
    </Wrapper>
  )
}

export default Record
