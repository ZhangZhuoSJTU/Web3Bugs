import { useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { spacingIncrement, Button, Icon, centered, ButtonProps } from 'prepo-ui'
import { displayDecimals } from 'prepo-utils'
import LoadingLottie from './lottie-animations/LoadingLottie'
import { Erc20Store } from '../stores/entities/Erc20.entity'
import { SupportedContractsNames } from '../lib/contract.types'

type DynamicCopy = ((symbol: string, amount: string) => React.ReactNode) | React.ReactNode
type ContentType = 'deposit' | 'openTrade' | 'closeTrade'

const contentMap: {
  [key in ContentType]: {
    description?: DynamicCopy
    notification?: string
    title?: DynamicCopy
  }
} = {
  deposit: {
    description: (symbol, amount) => (
      <>
        prePO needs your permission in order to deposit{' '}
        <span>
          {displayDecimals(amount)} {symbol}
        </span>{' '}
        on your behalf.
      </>
    ),
  },
  openTrade: {
    description:
      'Uniswap needs permission to use your deposited funds to open your desired position.',
    notification: 'Approved for opening position',
    title: 'Approval to open position',
  },
  closeTrade: {
    description: 'Uniswap needs permission to close your position in this market.',
    notification: 'Approved for closing position',
    title: 'Approval to close position',
  },
}

export type UnlockOptions = {
  amount: string
  token: Erc20Store
  spenderContractName?: SupportedContractsNames
  contentType?: ContentType
}

const Wrapper = styled.div``

const Head = styled.div`
  display: flex;
  justify-content: center;
  padding-bottom: ${spacingIncrement(24)};
  padding-top: ${spacingIncrement(80)};
`

const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(24)};
  padding-top: ${spacingIncrement(24)};
`

const Title = styled.div`
  color: ${({ theme }): string => `${theme.color.neutral1}`};
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: ${spacingIncrement(15)};
  text-align: center;
`

const Description = styled.div`
  color: ${({ theme }): string => `${theme.color.neutral3}`};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  height: ${spacingIncrement(54)};

  text-align: center;
  span {
    color: ${({ theme }): string => `${theme.color.primary}`};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  }
`

const Circle = styled.div`
  background: linear-gradient(90deg, #6264d9 0%, #454699 98.72%);
  border-radius: 50%;
  height: 86.83px;
  left: 0px;
  top: 0px;
  width: 86.83px;
  ${centered};
`

const buttonProps = (disabled: boolean): ButtonProps => ({
  block: true,
  disabled,
  type: 'primary',
})

const UnlockTokensModal: React.FC<UnlockOptions> = ({
  amount,
  contentType,
  spenderContractName,
  token,
}) => {
  const { approving, symbolString, symbolOverride, unlockPermanently, unlockThisTimeOnly } = token

  const symbol = (symbolOverride || symbolString) ?? ''
  const notification = contentType ? contentMap[contentType].notification : undefined

  const getDynamicContent = useCallback(
    (content: DynamicCopy): React.ReactNode => {
      if (typeof content === 'function') return content(symbol, amount)
      return content
    },
    [amount, symbol]
  )

  const renderTitle = useMemo(() => {
    if (!contentType || !contentMap[contentType].title) return `Approve ${symbol} Tokens`
    return getDynamicContent(contentMap[contentType].title)
  }, [contentType, getDynamicContent, symbol])

  const renderDescription = useMemo(() => {
    if (!contentType || !contentMap[contentType].description)
      return (
        <>
          prePO needs your permission in order to move{' '}
          <span>
            {displayDecimals(amount)} {symbol}
          </span>{' '}
          on your behalf.
        </>
      )
    return getDynamicContent(contentMap[contentType].description)
  }, [amount, contentType, getDynamicContent, symbol])

  return (
    <Wrapper>
      <Head>
        {approving ? (
          <LoadingLottie height={86} width={86} />
        ) : (
          <Circle>
            <Icon name="lockIcon" color="white" height="32" width="24" />
          </Circle>
        )}
      </Head>
      <Title>{renderTitle}</Title>
      <Description>{renderDescription}</Description>
      <ButtonWrapper>
        <Button
          onClick={(): void => {
            unlockPermanently(spenderContractName, notification)
          }}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...buttonProps(approving)}
        >
          Approve permanently
        </Button>
        <Button
          onClick={(): void => {
            unlockThisTimeOnly(amount, spenderContractName, notification)
          }}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...buttonProps(approving)}
        >
          Approve this time only
        </Button>
      </ButtonWrapper>
    </Wrapper>
  )
}

export default observer(UnlockTokensModal)
