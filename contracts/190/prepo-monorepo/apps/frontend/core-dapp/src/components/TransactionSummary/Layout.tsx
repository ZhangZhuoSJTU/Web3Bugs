import styled from 'styled-components'
import { centered, spacingIncrement, Button, Icon, ButtonProps } from 'prepo-ui'
import Lottie, { Options } from 'react-lottie'
import Link from '../Link'

type Props = {
  lottieOptions?: Options
  button?: ButtonProps
  message?: string
  txUrl?: string
}

const MessageText = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: ${spacingIncrement(20)};
  margin-top: ${spacingIncrement(9)};
  text-align: center;
`

const TxUrlText = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: 0;
  margin-right: ${spacingIncrement(8)};
  text-align: center;
`

const TxUrlWrapper = styled.div`
  ${centered}
  margin-top: ${spacingIncrement(17)};
`

const Wrapper = styled.div<{ hasLink: boolean }>`
  min-height: ${spacingIncrement(300)};

  padding-bottom: ${({ hasLink }): string =>
    hasLink ? spacingIncrement(4) : spacingIncrement(38)};
`

const defaultOptions = {
  loop: true,
  autoplay: true,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
}

const TransactionSummaryLayout: React.FC<Props> = ({
  lottieOptions,
  button,
  children,
  message,
  txUrl,
}) => (
  <Wrapper hasLink={Boolean(txUrl)}>
    {children}
    {lottieOptions !== undefined && (
      <Lottie height={142} width={142} options={{ ...defaultOptions, ...lottieOptions }} />
    )}
    {Boolean(message) && <MessageText>{message}</MessageText>}
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    {button && <Button block {...button} />}
    {txUrl && (
      <Link href={txUrl} target="_blank">
        <TxUrlWrapper>
          <TxUrlText>View Transaction in Explorer</TxUrlText>
          <Icon name="share" width="18" height="18" />
        </TxUrlWrapper>
      </Link>
    )}
  </Wrapper>
)

export default TransactionSummaryLayout
