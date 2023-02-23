import styled from 'styled-components'
import { centered, media, Icon } from 'prepo-ui'
import Link from './Link'
import AdvancedSettingsModal from './AdvancedSettingsModal'
import { useRootStore } from '../context/RootStoreProvider'

type Props = {
  title: string
  showAdvancedSettings?: boolean
  backUrl?: string
  className?: string
}

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const BackArrowWrapper = styled(Link)`
  ${centered};
`

const Title = styled.div`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  text-align: center;
  width: 100%;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const SettingsWrapper = styled.div`
  ${centered};
  cursor: pointer;
`

const SecondaryNavigation: React.FC<Props> = ({
  className,
  backUrl,
  title,
  showAdvancedSettings = false,
}) => {
  const { advancedSettingsStore } = useRootStore()
  const onClickSettings = (): void => advancedSettingsStore.setIsSettingsOpen(true)
  return (
    <Wrapper className={className}>
      <AdvancedSettingsModal />
      {backUrl ? (
        <BackArrowWrapper href={backUrl}>
          <Icon name="arrow-left" color="neutral5" />
        </BackArrowWrapper>
      ) : null}
      <Title>{title}</Title>
      {showAdvancedSettings && (
        <SettingsWrapper>
          <Icon name="settings" color="neutral5" width="19" height="20" onClick={onClickSettings} />
        </SettingsWrapper>
      )}
    </Wrapper>
  )
}

export default SecondaryNavigation
