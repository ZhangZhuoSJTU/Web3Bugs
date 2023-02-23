import { observer } from 'mobx-react-lite'
import Link from 'next/link'
import { Flex, Icon, IconName, Tooltip } from 'prepo-ui'
import { MouseEventHandler, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'
import { getShortAccount } from '../../utils/account-utils'

type ActionIconProps = {
  iconName: IconName
  href?: string
  onClick?: MouseEventHandler<HTMLDivElement>
  overlay?: string
}

const NonInteractiveText = styled.span`
  color: ${({ theme }): string => theme.color.neutral2};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const ActionIconWrapper = styled.div`
  cursor: pointer;
  :hover {
    a {
      color: ${({ theme }): string => theme.color.neutral2};
    }
    opacity: 70%;
  }
`

const ActionIcon: React.FC<ActionIconProps> = ({ iconName, href, onClick, overlay }) => {
  const icon = <Icon name={iconName} height="18" width="18" />

  if (href)
    return (
      <Tooltip overlay={overlay ?? ''}>
        <ActionIconWrapper onClick={onClick}>
          <Link href={href} target="_blank">
            <a href={href} target="_blank" rel="noreferrer">
              {icon}
            </a>
          </Link>
        </ActionIconWrapper>
      </Tooltip>
    )

  return (
    <Tooltip overlay={overlay ?? ''}>
      <ActionIconWrapper onClick={onClick}>{icon}</ActionIconWrapper>
    </Tooltip>
  )
}

const WalletInfo: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { web3Store } = useRootStore()
  const { address } = web3Store
  const [copied, setCopied] = useState(false)

  if (!address) return null

  const handleDisconnect = (): void => {
    web3Store.disconnect()
    onClose()
  }

  const onCopy = (): void => {
    if (copied) return
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1000)
  }

  return (
    <Flex flexDirection="column" width="100%">
      <Flex alignItems="center" justifyContent="space-between" px={24} width="100%">
        <NonInteractiveText>{getShortAccount(address)}</NonInteractiveText>
        <Flex gap={8} color="neutral1">
          <CopyToClipboard text={address} onCopy={onCopy}>
            <ActionIcon
              overlay={copied ? 'Copied!' : 'Copy'}
              iconName={copied ? 'check' : 'copy'}
            />
          </CopyToClipboard>
          <ActionIcon
            overlay="Explore"
            iconName="etherscan"
            href={web3Store.getBlockExplorerUrl(address)}
          />
          <ActionIcon overlay="Disconnect" iconName="power" onClick={handleDisconnect} />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default observer(WalletInfo)
